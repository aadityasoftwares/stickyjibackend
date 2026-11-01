// Must execute before static service imports load R2 configuration.
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "workspace-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://files.example.test";
process.env.CLOUDFLARE_R2_BUCKET_IS_PRIVATE = "false";
