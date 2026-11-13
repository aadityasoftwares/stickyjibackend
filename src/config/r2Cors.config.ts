import type { CORSRule } from "@aws-sdk/client-s3";
import { getAllowedOrigins } from "./cors.config.js";

export function createR2CorsRule(env: NodeJS.ProcessEnv = process.env): CORSRule {
    const origins = getAllowedOrigins(env);
    if (!origins.length)
        throw new Error("Set CLIENT_URL or CORS_ALLOWED_ORIGINS before configuring R2 CORS.");
    return {
        ID: `stickyji-browser-uploads-${env.NODE_ENV || "development"}`,
        AllowedOrigins: origins,
        AllowedMethods: ["PUT", "GET", "HEAD"],
        AllowedHeaders: ["Content-Type", "If-None-Match"],
        ExposeHeaders: ["ETag"],
        MaxAgeSeconds: 300,
    };
}

export function mergeR2CorsRules(existing: CORSRule[], rule: CORSRule): CORSRule[] {
    return [rule, ...existing.filter((item) => item.ID !== rule.ID)];
}
