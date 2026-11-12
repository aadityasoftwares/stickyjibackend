import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaUrl } from "../src/modules/media/utils/mediaUrl.util.js";
import { attachmentResponse } from "../src/modules/stickynoteattachment/utils/attachmentResponse.js";
import { MediaService } from "../src/modules/media/services/media.service.js";
import { Types } from "mongoose";

test("buildMediaUrl generates public URLs using media.stickyji.com", () => {
    const storageKey = "tenants/65b123/workspaces/65b456/notes/65b789/attachments/2026/11/test.png";
    const expectedUrl = `https://media.stickyji.com/${storageKey}`;

    assert.equal(buildMediaUrl(storageKey), expectedUrl);
    assert.equal(buildMediaUrl(`/${storageKey}`), expectedUrl);

    // Normalizing legacy aadityasoftwares.fun URL
    const legacyUrl = "https://aadityasoftwares.fun/accounts/user1/avatars/avatar.jpg";
    assert.equal(
        buildMediaUrl(undefined, legacyUrl),
        "https://media.stickyji.com/accounts/user1/avatars/avatar.jpg",
    );

    // Empty/null cases
    assert.equal(buildMediaUrl(null, null), null);
    assert.equal(buildMediaUrl("", ""), null);
});

test("attachmentResponse includes public media URL for sticky note attachments", () => {
    const mediaId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const storageKey = "tenants/65b123/workspaces/65b456/notes/65b789/attachments/2026/11/doc.pdf";

    const response = attachmentResponse({
        _id: mediaId,
        originalFileName: "doc.pdf",
        mimeType: "application/pdf",
        size: 1024,
        status: "ACTIVE",
        storageKey,
        uploadedBy: userId,
        sortOrder: 1,
        uploadedAt: new Date("2026-11-12T00:00:00Z"),
        createdAt: new Date("2026-11-12T00:00:00Z"),
    });

    assert.equal(response.attachmentId, mediaId.toString());
    assert.equal(response.mediaId, mediaId.toString());
    assert.equal(response.fileName, "doc.pdf");
    assert.equal(response.mimeType, "application/pdf");
    assert.equal(response.size, 1024);
    assert.equal(response.status, "ACTIVE");
    assert.equal(response.url, `https://media.stickyji.com/${storageKey}`);
});

test("MediaService.getDownloadUrl returns media.stickyji.com downloadUrl for bucket objects", async () => {
    const mediaService = new MediaService();
    const storageKey = "tenants/6ade26babb10cefd3e3b575a/workspaces/6ade26bbbb10cefd3e3b5764/notes/6adf76a69d4970578bee5fff/attachments/2026/11/2b51ca84-446e-4b05-b8f2-6686a722fd69.png";
    const mediaId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();

    // Mock findAuthorized to return a sample media object in main bucket
    mediaService["findAuthorized"] = async () => ({
        _id: mediaId,
        storageKey,
        status: "ACTIVE",
        bucket: "stickyji",
        visibility: "PRIVATE",
        originalFileName: "image.png",
    });

    const result = await mediaService.getDownloadUrl(mediaId, userId);
    assert.equal(
        result.downloadUrl,
        `https://media.stickyji.com/${storageKey}`,
    );
    assert.equal(
        result.url,
        `https://media.stickyji.com/${storageKey}`,
    );
});
