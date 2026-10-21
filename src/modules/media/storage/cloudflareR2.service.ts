import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../../utils/errors/app.error.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { cloudflareR2Client, R2_CONFIG, } from "../../../config/cloudflareR2.config.js";

export class CloudflareR2Service {
    private readonly client = cloudflareR2Client;
    private readonly bucketName = R2_CONFIG.BUCKET_NAME;
    private readonly publicUrl = R2_CONFIG.PUBLIC_URL;

    getBucketName(): string {
        return this.bucketName;
    }

    getPublicUrl(storageKey: string): string {
        return `${this.publicUrl}/${storageKey}`;
    }

    async createUploadUrl(
        storageKey: string,
        mimeType: string,
        size: number,
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: storageKey,
            ContentType: mimeType,
            ContentLength: size,
        });

        return getSignedUrl(
            this.client,
            command,
            {
                expiresIn:
                    MEDIA_CONSTANTS.UPLOAD_URL_EXPIRES_IN_SECONDS,
            },
        );
    }

    async headObject(storageKey: string) {
        try {
            return await this.client.send(
                new HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: storageKey,
                }),
            );
        } catch {
            throw new AppError(
                MediaMessages.STORAGE_OBJECT_NOT_FOUND,
                404,
            );
        }
    }

    async deleteObject(storageKey: string): Promise<void> {
        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: storageKey,
            }),
        );
    }
}
