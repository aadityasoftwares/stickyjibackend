import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { StorageKeyBuilder } from "../src/modules/media/storage/storageKey.builder.ts";
import { MediaContentService } from "../src/modules/media/services/mediaContent.service.ts";
import { MediaSecurity } from "../src/modules/media/constants/mediaSecurity.constants.ts";
const accountId = "000000000000000000000001";
const workspaceId = "000000000000000000000002";
const noteId = "000000000000000000000003";

test("central keys separate accounts, workspaces and notes, use UTC and random UUIDs", () => {
    const date = new Date("2026-01-01T00:00:00Z");
    const avatar = StorageKeyBuilder.build({ accountId }, "AVATAR", "jpg", date);
    assert.match(
        avatar,
        new RegExp(`^accounts/${accountId}/users/${accountId}/avatars/2026/01/[0-9a-f-]{36}\\.jpg$`),
    );
    const scope = { accountId, tenantId: accountId, workspaceId, noteId };
    const attachment = StorageKeyBuilder.build(scope, "ATTACHMENT", "png", date);
    assert.match(
        attachment,
        new RegExp(`^tenants/${accountId}/workspaces/${workspaceId}/notes/${noteId}/attachments/2026/01/`),
    );
    assert.notEqual(attachment, StorageKeyBuilder.build(scope, "ATTACHMENT", "png", date));
    assert.match(
        StorageKeyBuilder.build({ accountId, tenantId: accountId, workspaceId }, "LOGO", "png", date),
        /\/assets\/logos\//,
    );
    for (const invalid of ["../bad", "a/b", "", "user%2Fid"])
        assert.throws(() => StorageKeyBuilder.build({ accountId: invalid }, "AVATAR", "png"));
    assert.throws(() => StorageKeyBuilder.build(scope, "ATTACHMENT", "exe"));
    assert.throws(() => StorageKeyBuilder.build({ accountId, noteId }, "ATTACHMENT", "png"));
});

const verify = (bytes, mimeType, size = bytes.length) =>
    new MediaContentService().verify(
        {
            readObject: async () => Readable.from([bytes.subarray(0, 3), bytes.subarray(3)]),
        },
        { storageKey: "test", bucket: "test", mimeType, size },
    );

test("actual image decoding and streaming hash reject spoofed MIME, truncation and size mismatch", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } })
        .png()
        .toBuffer();
    assert.equal(await verify(bytes, "image/png"), createHash("sha256").update(bytes).digest("hex"));
    await assert.rejects(() => verify(bytes, "image/jpeg"));
    await assert.rejects(() => verify(bytes.subarray(0, 20), "image/png"));
    await assert.rejects(() => verify(bytes, "image/png", bytes.length - 1));
    await assert.rejects(() => verify(Buffer.from("<svg onload='alert(1)'>"), "image/png"));
});

test("text verification supports UTF-8 across stream boundaries and rejects binary files", async () => {
    assert.match(await verify(Buffer.from("नमस्ते\n"), "text/plain"), /^[a-f0-9]{64}$/);
    await assert.rejects(() => verify(Buffer.from([0xff, 0x00]), "text/plain"));
    await assert.rejects(() => verify(Buffer.from("MZ\x00\x01"), "text/plain"));
});

test("active content is blocked and document scanning fails closed", async () => {
    for (const mime of ["image/svg+xml", "text/html", "application/x-msdownload", "application/zip"])
        assert.throws(() => MediaSecurity.format(mime));
    const previous = process.env.MEDIA_CLAMSCAN_PATH;
    delete process.env.MEDIA_CLAMSCAN_PATH;
    assert.throws(() => MediaSecurity.format("application/pdf"));
    process.env.MEDIA_CLAMSCAN_PATH = "nonexistent-stickyji-scanner";
    await assert.rejects(() => verify(Buffer.from("%PDF-1.7 test"), "application/pdf"));
    if (previous) process.env.MEDIA_CLAMSCAN_PATH = previous;
    else delete process.env.MEDIA_CLAMSCAN_PATH;
});

test("R2 PUT signs create-once headers and GET forces safe download disposition", async () => {
    for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"])
        process.env[`CLOUDFLARE_R2_${key}`] = "test";
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";
    process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME = "test-private";
    process.env.CLOUDFLARE_R2_BUCKET_IS_PRIVATE = "false";
    const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
    const r2 = new CloudflareR2Service();
    const put = new URL(await r2.createUploadUrl("key", "text/plain", 10, "test-private"));
    const headers = put.searchParams.get("X-Amz-SignedHeaders");
    assert.ok(headers.includes("content-type"));
    assert.ok(headers.includes("if-none-match"));
    assert.equal(put.searchParams.has("x-amz-checksum-crc32"), false, "Do not sign an empty-body checksum for a browser-supplied file");
    const get = new URL(await r2.createDownloadUrl("legacy/key", 300, 'a"\r\n<script>.txt', "test-private"));
    assert.equal(get.searchParams.get("response-content-type"), "application/octet-stream");
    assert.match(get.searchParams.get("response-content-disposition"), /^attachment;/);
    assert.ok(!get.searchParams.get("response-content-disposition").includes("\r"));
    assert.throws(() => r2.assertBucket("other-environment"));
    const { R2_CONFIG } = await import("../src/config/cloudflareR2.config.ts");
    const previous = { private: R2_CONFIG.BUCKET_IS_PRIVATE, bucket: R2_CONFIG.PRIVATE_BUCKET_NAME };
    try {
        R2_CONFIG.BUCKET_IS_PRIVATE = true;
        R2_CONFIG.PRIVATE_BUCKET_NAME = R2_CONFIG.BUCKET_NAME;
        assert.equal(r2.getUploadBucket(true), R2_CONFIG.BUCKET_NAME);
        assert.throws(() => r2.getPublicUrl("private-file"));
        R2_CONFIG.BUCKET_IS_PRIVATE = false;
        assert.throws(() => r2.getUploadBucket(true), { statusCode: 503 });
    } finally {
        R2_CONFIG.BUCKET_IS_PRIVATE = previous.private;
        R2_CONFIG.PRIVATE_BUCKET_NAME = previous.bucket;
    }
});
