import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../../utils/errors/app.error.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { cloudflareR2Client, R2_CONFIG } from "../../../config/cloudflareR2.config.js";
import { Readable } from "node:stream";

export class CloudflareR2Service {
    private readonly client = cloudflareR2Client;
    private readonly bucketName = R2_CONFIG.BUCKET_NAME;
    private readonly publicUrl = R2_CONFIG.PUBLIC_URL;

    getBucketName(): string {
        return this.bucketName;
    }

    getUploadBucket(isPrivate: boolean): string {
        if (!isPrivate) return this.bucketName;
        if (
            !R2_CONFIG.PRIVATE_BUCKET_NAME ||
            (R2_CONFIG.PRIVATE_BUCKET_NAME === this.bucketName && !R2_CONFIG.BUCKET_IS_PRIVATE)
        ) {
            throw new AppError(
                "Private R2 storage is not configured. Set CLOUDFLARE_R2_BUCKET_IS_PRIVATE=true for a bucket with public access disabled, or configure CLOUDFLARE_R2_PRIVATE_BUCKET_NAME.",
                503,
            );
        }
        return R2_CONFIG.PRIVATE_BUCKET_NAME;
    }

    assertBucket(bucket: string): string {
        if (
            bucket !== this.bucketName &&
            (!R2_CONFIG.PRIVATE_BUCKET_NAME || bucket !== R2_CONFIG.PRIVATE_BUCKET_NAME)
        ) {
            throw new AppError("Media bucket is not configured for this environment.", 409);
        }
        return bucket;
    }

    getPublicUrl(storageKey: string): string {
        if (!this.isPublicBucket(this.bucketName))
            throw new AppError("This R2 bucket is private; use a signed download URL.", 409);
        return `${this.publicUrl}/${storageKey}`;
    }

    isPublicBucket(bucket: string): boolean {
        return bucket === this.bucketName && !R2_CONFIG.BUCKET_IS_PRIVATE && Boolean(this.publicUrl);
    }

    async createUploadUrl(
        storageKey: string,
        mimeType: string,
        size: number,
        bucket: string = this.bucketName,
        expiresIn: number = MEDIA_CONSTANTS.UPLOAD_URL_EXPIRES_IN_SECONDS,
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.assertBucket(bucket),
            Key: storageKey,
            ContentType: mimeType,
            ContentLength: size,
            IfNoneMatch: "*",
        });

        return getSignedUrl(this.client, command, {
            expiresIn,
            signableHeaders: new Set(["content-type", "if-none-match"]),
        });
    }

    async createDownloadUrl(
        storageKey: string,
        expiresInSeconds: number = MEDIA_CONSTANTS.DOWNLOAD_URL_EXPIRES_IN_SECONDS,
        fileName?: string,
        bucket: string = this.bucketName,
    ): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.assertBucket(bucket),
            Key: storageKey,
            ...(fileName
                ? {
                      ResponseContentType: "application/octet-stream",
                      ResponseContentDisposition: `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
                  }
                : {}),
        });

        return getSignedUrl(this.client, command, {
            expiresIn: expiresInSeconds,
        });
    }

    async headObject(storageKey: string, bucket: string = this.bucketName) {
        return await this.client.send(
            new HeadObjectCommand({
                Bucket: this.assertBucket(bucket),
                Key: storageKey,
            }),
        );
    }

    async readObject(storageKey: string, bucket: string): Promise<Readable> {
        const response = await this.client.send(
            new GetObjectCommand({ Bucket: this.assertBucket(bucket), Key: storageKey }),
        );
        if (!(response.Body instanceof Readable)) throw new AppError("Storage object is unreadable.", 502);
        return response.Body;
    }

    /** Operator-only migration primitive; never used by normal upload controllers. */
    async copyObject(
        sourceKey: string,
        sourceBucket: string,
        destinationKey: string,
        destinationBucket: string,
        etag: string,
    ) {
        await this.client.send(
            new CopyObjectCommand({
                Bucket: this.assertBucket(destinationBucket),
                Key: destinationKey,
                CopySource: `${this.assertBucket(sourceBucket)}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
                CopySourceIfMatch: etag,
            }),
        );
    }

    async deleteObject(storageKey: string, bucket: string = this.bucketName): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.assertBucket(bucket),
                Key: storageKey,
            }),
        );
    }
}
