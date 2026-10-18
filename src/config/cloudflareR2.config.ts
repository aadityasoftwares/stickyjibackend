import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

const requiredEnv = [
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CLOUDFLARE_R2_PUBLIC_URL",
] as const;

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(
            `Missing required env variable: ${key}`,
        );
    }
}

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID as string;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID as string;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY as string;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME as string;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL as string;

export const cloudflareR2Client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

export const R2_CONFIG = {
    ACCOUNT_ID: accountId,
    ACCESS_KEY_ID: accessKeyId,
    SECRET_ACCESS_KEY: secretAccessKey,
    BUCKET_NAME: bucketName,
    PUBLIC_URL: publicUrl.replace(/\/$/, ""),
    ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
} as const;