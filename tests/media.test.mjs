import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";

process.env.JWT_ACCESS_SECRET = "media-test-access-secret";
process.env.JWT_REFRESH_SECRET = "media-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "media-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { StickyNoteModel } = await import("../src/modules/stickynotes/models/stickynote.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { MediaRepository } = await import("../src/modules/media/repositories/media.repository.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
    MediaStorageProvider,
} = await import("../src/modules/media/constants/media.enums.js");
const { MediaMessages } = await import("../src/modules/media/constants/media.messages.js");
const { MEDIA_CONSTANTS } = await import("../src/modules/media/constants/media.constants.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: mediaRoutes } = await import("../src/modules/media/routes/media.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let userA, userB, workspaceA, noteA;
let storageFails = false;
let mockStorageObjects = new Map();

// Mock CloudflareR2Service network operations for reliable testing
CloudflareR2Service.prototype.createUploadUrl = async function (storageKey, mimeType, size) {
    return `https://mock-r2.test/upload/${storageKey}?expires=900`;
};

CloudflareR2Service.prototype.createDownloadUrl = async function (storageKey, expiresIn = 900) {
    return `https://mock-r2.test/download/${storageKey}?expires=${expiresIn}`;
};

CloudflareR2Service.prototype.headObject = async function (storageKey) {
    if (storageFails) {
        throw new Error("Simulated storage network failure");
    }
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
    if (storageFails) {
        throw new Error("Simulated R2 delete error");
    }
    mockStorageObjects.delete(storageKey);
};

const mediaService = new MediaService();
const mediaRepository = new MediaRepository();

async function createTestUser(emailPrefix) {
    return UserModel.create({
        email: `${emailPrefix}-${new Types.ObjectId()}@test.com`,
        password: "hashedPassword123!",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "media-test-"));
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
            "mediaTestSet",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/media_test?directConnection=true`, {
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
        replSetInitiate: { _id: "mediaTestSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();
    await MediaModel.createIndexes();

    userA = await createTestUser("usera");
    userB = await createTestUser("userb");

    workspaceA = await WorkspaceModel.create({
        name: "Workspace A",
        slug: "workspace-a",
        ownerId: userA._id,
        status: "ACTIVE",
    });

    noteA = await StickyNoteModel.create({
        title: "Note A",
        content: "Content",
        workspaceId: workspaceA._id,
        columnId: new Types.ObjectId(),
        stickyNoteNumber: 1,
        createdById: userA._id,
        createdBy: userA._id,
        updatedBy: userA._id,
        status: "ACTIVE",
    });

    const app = express();
    app.use(express.json());
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

test("1. Successful upload initialization creates PENDING record with presigned uploadUrl", async () => {
    const res = await mediaService.requestUpload(
        {
            fileName: "profile.png",
            mimeType: "image/png",
            size: 1024 * 50,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.AVATAR,
            visibility: MediaVisibility.PUBLIC,
            resourceType: MediaResourceType.USER,
            resourceId: userA._id.toString(),
        },
        userA._id.toString(),
    );

    assert.ok(res.mediaId);
    assert.ok(res.uploadUrl);
    assert.ok(res.storageKey);
    assert.equal(res.media.status, MediaStatus.PENDING);
    assert.ok(res.media.uploadExpiresAt);
    assert.equal(res.media.size, 1024 * 50);
    assert.equal(res.media.mimeType, "image/png");

    const inDb = await MediaModel.findById(res.mediaId);
    assert.ok(inDb);
    assert.equal(inDb.status, MediaStatus.PENDING);
});

test("2. Successful upload confirmation transitions media from PENDING to ACTIVE", async () => {
    const init = await mediaService.requestUpload(
        {
            fileName: "document.pdf",
            mimeType: "application/pdf",
            size: 2048,
            mediaType: MediaType.DOCUMENT,
            purpose: MediaPurpose.ATTACHMENT,
            visibility: MediaVisibility.PRIVATE,
            resourceType: MediaResourceType.NOTE,
            resourceId: noteA._id.toString(),
        },
        userA._id.toString(),
    );

    // Simulate R2 object written
    mockStorageObjects.set(init.storageKey, {
        size: 2048,
        mimeType: "application/pdf",
    });

    const completed = await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());

    assert.equal(completed.status, MediaStatus.ACTIVE);
    assert.equal(completed.uploadExpiresAt, null);

    const inDb = await MediaModel.findById(init.mediaId);
    assert.equal(inDb.status, MediaStatus.ACTIVE);
    assert.equal(inDb.uploadExpiresAt, null);
});

test("3. Upload initialization rejects invalid file types and purpose/type mismatches", async () => {
    // Media type mismatch (text/plain passed as IMAGE)
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "test.txt",
                    mimeType: "text/plain",
                    size: 100,
                    mediaType: MediaType.IMAGE,
                    purpose: MediaPurpose.ATTACHMENT,
                },
                userA._id.toString(),
            ),
        (err) => err.statusCode === 400 && err.message === MediaMessages.MEDIA_TYPE_MISMATCH,
    );

    // Purpose mismatch (DOCUMENT passed for AVATAR purpose)
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "avatar.pdf",
                    mimeType: "application/pdf",
                    size: 100,
                    mediaType: MediaType.DOCUMENT,
                    purpose: MediaPurpose.AVATAR,
                },
                userA._id.toString(),
            ),
        (err) => err.statusCode === 400 && err.message === MediaMessages.PURPOSE_MEDIA_TYPE_MISMATCH,
    );
});

test("4. Upload initialization rejects invalid file size and exceeds purpose limits", async () => {
    // Non-positive or float size
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "pic.png",
                    mimeType: "image/png",
                    size: -50,
                    mediaType: MediaType.IMAGE,
                    purpose: MediaPurpose.ATTACHMENT,
                },
                userA._id.toString(),
            ),
        (err) => err.statusCode === 400 && err.message === MediaMessages.INVALID_FILE_SIZE,
    );

    // Exceeds purpose limit (avatar max is 5MB, passing 6MB)
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "avatar.png",
                    mimeType: "image/png",
                    size: 6 * 1024 * 1024,
                    mediaType: MediaType.IMAGE,
                    purpose: MediaPurpose.AVATAR,
                },
                userA._id.toString(),
            ),
        (err) => err.statusCode === 400 && err.message === MediaMessages.FILE_SIZE_EXCEEDS_PURPOSE_LIMIT,
    );
});

test("5. Unauthorized media access is prevented across users", async () => {
    const init = await mediaService.requestUpload(
        {
            fileName: "secret.png",
            mimeType: "image/png",
            size: 500,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.OTHER,
            visibility: MediaVisibility.PRIVATE,
        },
        userA._id.toString(),
    );

    // User B cannot complete User A's upload
    await assert.rejects(
        () => mediaService.completeUpload(init.mediaId.toString(), userB._id.toString()),
        (err) => err.statusCode === 404,
    );

    // User B cannot get User A's media metadata
    await assert.rejects(
        () => mediaService.getMedia(init.mediaId.toString(), userB._id.toString()),
        (err) => err.statusCode === 404,
    );

    // User B cannot delete User A's media
    await assert.rejects(
        () => mediaService.deleteMedia(init.mediaId.toString(), userB._id.toString()),
        (err) => err.statusCode === 404,
    );
});

test("6. Resource ownership validation blocks unauthorized association", async () => {
    // User B trying to associate media with User A's workspace
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "w.png",
                    mimeType: "image/png",
                    size: 500,
                    mediaType: MediaType.IMAGE,
                    purpose: MediaPurpose.ATTACHMENT,
                    resourceType: MediaResourceType.WORKSPACE,
                    resourceId: workspaceA._id.toString(),
                },
                userB._id.toString(),
            ),
        (err) => err.statusCode === 403 || err.statusCode === 404,
    );

    // ResourceId provided without resourceType is rejected
    await assert.rejects(
        () =>
            mediaService.requestUpload(
                {
                    fileName: "w.png",
                    mimeType: "image/png",
                    size: 500,
                    mediaType: MediaType.IMAGE,
                    purpose: MediaPurpose.ATTACHMENT,
                    resourceId: workspaceA._id.toString(),
                },
                userA._id.toString(),
            ),
        (err) => err.statusCode === 400 && err.message === MediaMessages.INVALID_RESOURCE_TYPE,
    );
});

test("7. Duplicate upload confirmation is idempotent and returns existing active media", async () => {
    const init = await mediaService.requestUpload(
        {
            fileName: "pic2.png",
            mimeType: "image/png",
            size: 1000,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.ATTACHMENT,
        },
        userA._id.toString(),
    );

    mockStorageObjects.set(init.storageKey, { size: 1000, mimeType: "image/png" });

    const first = await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());
    assert.equal(first.status, MediaStatus.ACTIVE);

    // Duplicate call returns existing active media without error
    const second = await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());
    assert.equal(second.status, MediaStatus.ACTIVE);
    assert.equal(second._id.toString(), init.mediaId.toString());
});

test("8. Duplicate storage keys violate unique index safely", async () => {
    const key = "duplicate-test-key-12345";
    await MediaModel.create({
        uploadedBy: userA._id,
        storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
        bucket: "media-test",
        storageKey: key,
        originalFileName: "file1.png",
        mimeType: "image/png",
        size: 500,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
        status: MediaStatus.ACTIVE,
    });

    await assert.rejects(
        () =>
            MediaModel.create({
                uploadedBy: userA._id,
                storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
                bucket: "media-test",
                storageKey: key,
                originalFileName: "file2.png",
                mimeType: "image/png",
                size: 500,
                mediaType: MediaType.IMAGE,
                purpose: MediaPurpose.ATTACHMENT,
                status: MediaStatus.ACTIVE,
            }),
        (err) => err.code === 11000,
    );
});

test("9. Expired pending uploads are cleaned up safely", async () => {
    const expiredDoc = await MediaModel.create({
        uploadedBy: userA._id,
        storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
        bucket: "media-test",
        storageKey: "expired-test-key-999",
        originalFileName: "expired.png",
        mimeType: "image/png",
        size: 500,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
        status: MediaStatus.PENDING,
        uploadExpiresAt: new Date(Date.now() - 60000), // 1 minute in the past
    });

    mockStorageObjects.set("expired-test-key-999", { size: 500, mimeType: "image/png" });

    const cleaned = await mediaService.cleanupPendingUploads();
    assert.ok(cleaned >= 1);

    const doc = await MediaModel.findById(expiredDoc._id);
    assert.equal(doc, null);
    assert.equal(mockStorageObjects.has("expired-test-key-999"), false);
});

test("10. Successful storage deletion soft-deletes and removes from R2 and purges tombstone", async () => {
    const init = await mediaService.requestUpload(
        {
            fileName: "delete-me.png",
            mimeType: "image/png",
            size: 500,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.ATTACHMENT,
        },
        userA._id.toString(),
    );

    mockStorageObjects.set(init.storageKey, { size: 500, mimeType: "image/png" });
    await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());

    await mediaService.deleteMedia(init.mediaId.toString(), userA._id.toString());

    // R2 object removed
    assert.equal(mockStorageObjects.has(init.storageKey), false);

    // Document tombstone removed from DB
    const inDb = await MediaModel.findById(init.mediaId);
    assert.equal(inDb, null);
});

test("11. R2 deletion failure preserves tombstone with storageDeletionPending for retry", async () => {
    const init = await mediaService.requestUpload(
        {
            fileName: "retry-me.png",
            mimeType: "image/png",
            size: 800,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.ATTACHMENT,
        },
        userA._id.toString(),
    );

    mockStorageObjects.set(init.storageKey, { size: 800, mimeType: "image/png" });
    await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());

    // Cause R2 deletion to fail
    storageFails = true;
    try {
        await mediaService.deleteMedia(init.mediaId.toString(), userA._id.toString());
    } finally {
        storageFails = false;
    }

    // Tombstone should be preserved in DB with storageDeletionPending: true
    const tombstone = await MediaModel.findById(init.mediaId);
    assert.ok(tombstone);
    assert.equal(tombstone.status, MediaStatus.DELETED);
    assert.equal(tombstone.storageDeletionPending, true);

    // Now run cleanup retry: it should delete the R2 object and delete the tombstone
    const retryResult = await mediaService.cleanupPendingStorageDeletions();
    assert.ok(retryResult.deleted >= 1);

    const postRetryDoc = await MediaModel.findById(init.mediaId);
    assert.equal(postRetryDoc, null);
    assert.equal(mockStorageObjects.has(init.storageKey), false);
});

test("12. Concurrent cleanup attempts do not collide or error", async () => {
    // Create multiple expired pending uploads
    const docs = await Promise.all([
        MediaModel.create({
            uploadedBy: userA._id,
            storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
            bucket: "media-test",
            storageKey: `concurrent-key-1-${new Types.ObjectId()}`,
            originalFileName: "c1.png",
            mimeType: "image/png",
            size: 100,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.OTHER,
            status: MediaStatus.PENDING,
            uploadExpiresAt: new Date(Date.now() - 10000),
        }),
        MediaModel.create({
            uploadedBy: userA._id,
            storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
            bucket: "media-test",
            storageKey: `concurrent-key-2-${new Types.ObjectId()}`,
            originalFileName: "c2.png",
            mimeType: "image/png",
            size: 100,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.OTHER,
            status: MediaStatus.PENDING,
            uploadExpiresAt: new Date(Date.now() - 10000),
        }),
    ]);

    // Run two concurrent cleanups
    const [c1, c2] = await Promise.all([
        mediaService.cleanupPendingUploads(),
        mediaService.cleanupPendingUploads(),
    ]);

    assert.equal(c1 + c2, 2);

    for (const doc of docs) {
        const found = await MediaModel.findById(doc._id);
        assert.equal(found, null);
    }
});

test("13. Media listing and retrieval supports pagination and generates signed download URL for private files", async () => {
    const token = JwtUtil.generateAccessToken(userA._id.toString(), new Types.ObjectId().toString());

    const init = await mediaService.requestUpload(
        {
            fileName: "retrieval.png",
            mimeType: "image/png",
            size: 400,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.ATTACHMENT,
            visibility: MediaVisibility.PRIVATE,
        },
        userA._id.toString(),
    );

    mockStorageObjects.set(init.storageKey, { size: 400, mimeType: "image/png" });
    await mediaService.completeUpload(init.mediaId.toString(), userA._id.toString());

    // Test GET /media/get/:id
    const getRes = await fetch(`${baseUrl}/media/get/${init.mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.equal(getBody.data.publicUrl, null);
    assert.ok(getBody.data.downloadUrl);
    assert.match(getBody.data.downloadUrl, /mock-r2\.test\/download/);

    // Test dedicated GET /media/:id/download
    const dlRes = await fetch(`${baseUrl}/media/${init.mediaId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(dlRes.status, 200);
    const dlBody = await dlRes.json();
    assert.equal(dlBody.success, true);
    assert.ok(dlBody.data.downloadUrl);
    assert.equal(dlBody.data.visibility, MediaVisibility.PRIVATE);

    // Test GET /media/getall pagination
    const listRes = await fetch(`${baseUrl}/media/getall?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.success, true);
    assert.ok(Array.isArray(listBody.data));
    assert.ok(listBody.meta);
    assert.equal(listBody.meta.page, 1);
    assert.equal(listBody.meta.limit, 5);
});
