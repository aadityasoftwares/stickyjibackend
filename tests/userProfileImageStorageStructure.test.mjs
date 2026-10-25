import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";

process.env.JWT_ACCESS_SECRET = "storage-struct-test-access-secret";
process.env.JWT_REFRESH_SECRET = "storage-struct-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "storage-struct-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { MediaUtil } = await import("../src/modules/media/utils/media.util.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
} = await import("../src/modules/media/constants/media.enums.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: userProfileRoutes } = await import("../src/modules/userprofile/routes/userProfile.routes.ts");
const { default: mediaRoutes } = await import("../src/modules/media/routes/media.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let userA, userB;
let userAToken, userBToken;
let userAProfile, userBProfile;
const mockStorageObjects = new Map();

// Mock CloudflareR2Service operations
CloudflareR2Service.prototype.createUploadUrl = async function (storageKey, mimeType, size) {
    return `https://mock-r2.test/upload/${storageKey}?expires=900`;
};

CloudflareR2Service.prototype.createDownloadUrl = async function (storageKey, expiresIn = 900) {
    return `https://mock-r2.test/download/${storageKey}?expires=${expiresIn}`;
};

CloudflareR2Service.prototype.headObject = async function (storageKey) {
    const stored = mockStorageObjects.get(storageKey);
    if (!stored) {
        throw new Error("Storage object not found");
    }
    return {
        ContentLength: stored.size,
        ContentType: stored.mimeType,
    };
};

CloudflareR2Service.prototype.deleteObject = async function (storageKey) {
    mockStorageObjects.delete(storageKey);
};

const mediaService = new MediaService();

async function createTestUser(emailPrefix) {
    const user = await UserModel.create({
        email: `${emailPrefix}-${new Types.ObjectId()}@test.com`,
        password: "hashedPassword123!",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });

    const profile = await UserProfileModel.create({
        userId: user._id,
        firstName: "Test",
        lastName: "User",
        displayName: `${emailPrefix} User`,
        profileType: "PERSONAL",
        status: "ACTIVE",
        isDeleted: false,
    });

    return { user, profile };
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "storage-struct-test-"));
    mongoProcess = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            mongoDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--replSet",
            "storageStructSet",
            "--logpath",
            join(mongoDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongoProcess.on("error", (err) => {
        startupError = err;
    });

    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/storage_struct_test?directConnection=true`, {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (err) {
            if (attempt >= 40) throw err;
            await delay(250);
        }
    }

    await mongoose.connection.db.admin().command({
        replSetInitiate: { _id: "storageStructSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();
    await MediaModel.createIndexes();
    await UserProfileModel.createIndexes();

    const createdA = await createTestUser("usera");
    userA = createdA.user;
    userAProfile = createdA.profile;
    userAToken = JwtUtil.generateAccessToken(userA._id.toString(), new Types.ObjectId().toString());

    const createdB = await createTestUser("userb");
    userB = createdB.user;
    userBProfile = createdB.profile;
    userBToken = JwtUtil.generateAccessToken(userB._id.toString(), new Types.ObjectId().toString());

    const app = express();
    app.use(express.json());
    app.use("/userprofile", userProfileRoutes);
    app.use("/media", mediaRoutes);
    app.use(errorMiddleware);

    const httpSocket = createServer().listen(0, "127.0.0.1");
    await once(httpSocket, "listening");
    const httpPort = httpSocket.address().port;
    await new Promise((resolve) => httpSocket.close(resolve));

    server = app.listen(httpPort);
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${httpPort}`;
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState) await mongoose.disconnect();
    if (mongoProcess) {
        mongoProcess.kill();
        await delay(250);
    }
    if (mongoDirectory) await rm(mongoDirectory, { recursive: true, force: true }).catch(() => undefined);
});

test("1 & 2. User A uploads a profile image and image is saved under User A ID prefix", async () => {
    const year = new Date().getFullYear();
    const res = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "profile.png",
            mimeType: "image/png",
            size: 1024 * 50,
        }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.storageKey);

    // Expected prefix: user/avatars/{userA._id}/{year}/
    const expectedPrefix = `user/avatars/${userA._id.toString()}/${year}/`;
    assert.ok(
        body.data.storageKey.startsWith(expectedPrefix),
        `Storage key "${body.data.storageKey}" does not start with expected prefix "${expectedPrefix}"`,
    );

    // Verify key format: user/avatars/{userId}/{year}/{uuid}.png
    const pattern = new RegExp(`^user/avatars/${userA._id.toString()}/${year}/[0-9a-f-]+\\.png$`);
    assert.ok(pattern.test(body.data.storageKey), `Key "${body.data.storageKey}" does not match pattern ${pattern}`);
});

test("3 & 4. User B uploads a profile image and uses a different User B ID prefix", async () => {
    const year = new Date().getFullYear();
    const res = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
            fileName: "userb.png",
            mimeType: "image/png",
            size: 1024 * 40,
        }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const expectedPrefixB = `user/avatars/${userB._id.toString()}/${year}/`;

    assert.ok(
        body.data.storageKey.startsWith(expectedPrefixB),
        `Storage key "${body.data.storageKey}" does not start with User B prefix "${expectedPrefixB}"`,
    );
    assert.notEqual(userA._id.toString(), userB._id.toString());
});

test("5. PNG filename ends with .png", async () => {
    const res = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "sample.png",
            mimeType: "image/png",
            size: 1024 * 20,
        }),
    });
    const body = await res.json();
    assert.ok(body.data.storageKey.endsWith(".png"));
});

test("6. JPEG filename ends with .jpg", async () => {
    // Both .jpeg and .jpg filenames with image/jpeg should resolve to .jpg
    const res1 = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "photo.jpeg",
            mimeType: "image/jpeg",
            size: 1024 * 30,
        }),
    });
    const body1 = await res1.json();
    assert.ok(body1.data.storageKey.endsWith(".jpg"));

    const res2 = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "photo.jpg",
            mimeType: "image/jpeg",
            size: 1024 * 30,
        }),
    });
    const body2 = await res2.json();
    assert.ok(body2.data.storageKey.endsWith(".jpg"));
});

test("7. WebP filename ends with .webp", async () => {
    const res = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "modern.webp",
            mimeType: "image/webp",
            size: 1024 * 25,
        }),
    });
    const body = await res.json();
    assert.ok(body.data.storageKey.endsWith(".webp"));
});

test("8. No MIME-type slash or accidental MIME string appears in generated filename", async () => {
    // Even if frontend provides blob or no extension or weird filename
    const res = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "blob",
            mimeType: "image/png",
            size: 1024 * 15,
        }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    const key = body.data.storageKey;

    // Must not contain "image/png"
    assert.ok(!key.includes("image/png"), `Storage key "${key}" contains "image/png"`);
    assert.ok(!key.includes("image/"), `Storage key "${key}" contains "image/"`);

    // Must strictly have exactly 4 slash-separated segments: user/avatars/{userId}/{year}/{uuid.ext}
    const segments = key.split("/");
    assert.equal(segments.length, 5, `Expected 5 segments (user/avatars/userId/year/filename), got ${segments.length}`);
    assert.equal(segments[0], "user");
    assert.equal(segments[1], "avatars");
    assert.equal(segments[2], userA._id.toString());
    assert.equal(segments[3], String(new Date().getFullYear()));
    assert.ok(/^[0-9a-f-]+\.png$/.test(segments[4]));
});

test("9 & 10. Upload confirmation and presigned download URLs work with new storage structure", async () => {
    const uploadReq = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "confirm-test.png",
            mimeType: "image/png",
            size: 1024 * 50,
        }),
    });
    const reqBody = await uploadReq.json();
    const { mediaId, storageKey } = reqBody.data;

    // Mock R2 upload
    mockStorageObjects.set(storageKey, {
        size: 1024 * 50,
        mimeType: "image/png",
    });

    // Complete upload
    const completeRes = await fetch(`${baseUrl}/media/${mediaId}/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({}),
    });
    assert.equal(completeRes.status, 200);

    // Attach to profile
    const setRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId }),
    });
    assert.equal(setRes.status, 200);
    const setBody = await setRes.json();
    assert.ok(setBody.data.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(setBody.data.profileImage?.url.includes(encodeURIComponent(storageKey)) || setBody.data.profileImage?.url.includes(storageKey));
});

test("11 & 12. Existing profile image replacement and previous media cleanup work", async () => {
    // Current profile image
    const profile = await UserProfileModel.findById(userAProfile._id);
    const oldMediaId = profile.profileImage.toString();
    const oldMediaDoc = await MediaModel.findById(oldMediaId);
    assert.ok(oldMediaDoc);

    // Upload replacement image
    const uploadReq = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "replacement.jpg",
            mimeType: "image/jpeg",
            size: 1024 * 60,
        }),
    });
    const reqBody = await uploadReq.json();
    mockStorageObjects.set(reqBody.data.storageKey, {
        size: 1024 * 60,
        mimeType: "image/jpeg",
    });

    await fetch(`${baseUrl}/media/${reqBody.data.mediaId}/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({}),
    });

    const replaceRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: reqBody.data.mediaId }),
    });
    assert.equal(replaceRes.status, 200);

    await delay(150);

    // Old media must be cleaned up from DB
    const oldMediaCheck = await MediaModel.findById(oldMediaId);
    assert.ok(!oldMediaCheck || oldMediaCheck.status === MediaStatus.DELETED || oldMediaCheck.isDeleted);
});

test("13 & 14. Backward compatibility: Existing storage keys remain functional and retrievable", async () => {
    // Insert an old legacy media record with pre-existing storageKey format (e.g. without userId in folder)
    const legacyMedia = await MediaModel.create({
        uploadedBy: userA._id,
        storageProvider: "CLOUDFLARE_R2",
        bucket: "storage-struct-test",
        storageKey: "user/avatars/2025/legacy-avatar-old-format.png",
        originalFileName: "legacy.png",
        mimeType: "image/png",
        extension: "png",
        size: 1024 * 45,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.PROFILE_IMAGE,
        visibility: MediaVisibility.PRIVATE,
        status: MediaStatus.ACTIVE,
        resourceType: MediaResourceType.USER,
        resourceId: userA._id,
    });

    mockStorageObjects.set(legacyMedia.storageKey, {
        size: 1024 * 45,
        mimeType: "image/png",
    });

    // 1. Can retrieve legacy media directly via Media API
    const mediaRes = await fetch(`${baseUrl}/media/get/${legacyMedia._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });
    assert.equal(mediaRes.status, 200);
    const mediaBody = await mediaRes.json();
    assert.equal(mediaBody.data.storageKey, "user/avatars/2025/legacy-avatar-old-format.png");
    assert.ok(mediaBody.data.downloadUrl.includes("user/avatars/2025/legacy-avatar-old-format.png"));

    // 2. Can attach legacy media to UserProfile without errors
    const attachRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: legacyMedia._id.toString() }),
    });
    assert.equal(attachRes.status, 200);
    const attachBody = await attachRes.json();
    assert.equal(attachBody.data.profileImage?.id, legacyMedia._id.toString());
    assert.ok(attachBody.data.profileImage?.url.includes("user/avatars/2025/legacy-avatar-old-format.png"));
});

test("15. Unauthorized upload attempts are rejected", async () => {
    const unauthRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fileName: "hacker.png",
            mimeType: "image/png",
            size: 1024,
        }),
    });
    assert.equal(unauthRes.status, 401);
});

test("16. Other Media purposes remain unaffected by user profile structure changes", async () => {
    // Request upload for a workspace cover or attachment
    const otherRes = await mediaService.requestUpload(
        {
            fileName: "attachment.pdf",
            mimeType: "application/pdf",
            size: 1024 * 100,
            mediaType: MediaType.DOCUMENT,
            purpose: MediaPurpose.ATTACHMENT,
            visibility: MediaVisibility.PRIVATE,
        },
        userA._id.toString(),
    );

    const year = new Date().getFullYear();
    // Non-profile attachments must use their standard prefix (e.g. unlinked/attachments/{year}/...)
    assert.ok(
        otherRes.storageKey.startsWith(`unlinked/attachments/${year}/`),
        `Expected non-profile upload to start with unlinked/attachments/${year}/, got ${otherRes.storageKey}`,
    );
    assert.ok(!otherRes.storageKey.includes(userA._id.toString()));
});
