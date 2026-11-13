import "dotenv/config";
import { GetBucketCorsCommand, PutBucketCorsCommand, type CORSRule } from "@aws-sdk/client-s3";
import { cloudflareR2Client, R2_CONFIG } from "../config/cloudflareR2.config.js";
import { createR2CorsRule, mergeR2CorsRules } from "../config/r2Cors.config.js";

async function main() {
    const args = process.argv.slice(2);
    if (args.some((arg) => !["--apply", "--print"].includes(arg)) || args.length > 1) {
        throw new Error("Usage: npm run storage:cors -- [--apply | --print]");
    }
    const rule = createR2CorsRule();
    if (args.includes("--print")) {
        console.log(JSON.stringify([rule], null, 2));
        return;
    }
    const buckets = [...new Set([R2_CONFIG.BUCKET_NAME, R2_CONFIG.PRIVATE_BUCKET_NAME].filter(Boolean))];
    for (const bucket of buckets) {
        let existing: CORSRule[];
        try {
            const result = await cloudflareR2Client.send(new GetBucketCorsCommand({ Bucket: bucket }));
            existing = result.CORSRules ?? [];
        } catch (error) {
            if ((error as Error).name !== "NoSuchCORSConfiguration") throw error;
            existing = [];
        }
        const rules = mergeR2CorsRules(existing, rule);
        console.log(JSON.stringify({ bucket, existing, proposed: rules }, null, 2));
        if (args.includes("--apply")) {
            await cloudflareR2Client.send(
                new PutBucketCorsCommand({
                    Bucket: bucket,
                    CORSConfiguration: { CORSRules: rules },
                }),
            );
            const verified = await cloudflareR2Client.send(new GetBucketCorsCommand({ Bucket: bucket }));
            console.log(JSON.stringify({ bucket, applied: verified.CORSRules }, null, 2));
        }
    }
    if (!args.includes("--apply")) console.log("Preview only. Use --apply to update bucket CORS.");
}

main()
    .catch((error: unknown) => {
        const name = error instanceof Error ? error.name : "Error";
        const message = error instanceof Error ? error.message : "R2 CORS configuration failed.";
        console.error(`${name}: ${message}`);
        if (name === "AccessDenied") {
            console.error(
                "Bucket CORS requires R2 bucket administration permission. Use an authorized admin credential or add the --print rule in Cloudflare > R2 > bucket > Settings > CORS Policy, preserving existing rules.",
            );
        }
        process.exitCode = 1;
    })
    .finally(() => cloudflareR2Client.destroy());
