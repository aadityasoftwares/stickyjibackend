import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaUrl } from "../src/modules/media/utils/mediaUrl.util.js";
import { attachmentResponse } from "../src/modules/stickynoteattachment/utils/attachmentResponse.js";
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

