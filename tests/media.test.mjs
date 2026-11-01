import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";
import "./helpers/mediaVerificationMock.mjs";

process.env.JWT_ACCESS_SECRET = "media-test-access-secret";
process.env.JWT_REFRESH_SECRET = "media-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "media-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";
process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME = "media-test-private";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { StickyNoteModel } = await import("../src/modules/stickynotes/models/stickynote.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { MediaRepository } = await import("../src/modules/media/repositories/media.repository.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const { MediaStatus, MediaType, MediaPurpose, MediaVisibility, MediaResourceType, MediaStorageProvider } =
    await import("../src/modules/media/constants/media.enums.js");
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
const { StickyNoteAttachmentService } =
    await import("../src/modules/stickynoteattachment/services/stickyNoteAttachment.service.ts");
const { default: attachmentRoutes } =
    await import("../src/modules/stickynoteattachment/routes/stickyNoteAttachment.routes.ts");
const attachments = new StickyNoteAttachmentService();

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
    app.use("/stickynotes/:noteId/attachments", attachmentRoutes);
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
    assert.equal(mockStorageObjects.has(init.storageKey), true, "Keep object while signed PUT can be reused");
    await MediaModel.updateOne({ _id: init.mediaId }, { uploadUrlExpiresAt: new Date(Date.now() - 7200000) });
    await mediaService.cleanupPendingStorageDeletions();
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
    await MediaModel.updateOne({ _id: init.mediaId }, { uploadUrlExpiresAt: new Date(Date.now() - 7200000) });
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

async function newNote(owner = userA, workspace = workspaceA) {
    return StickyNoteModel.create({
        title: "Attachment test",
        content: "Test",
        updatedBy: owner._id,
        workspaceId: workspace._id,
        columnId: new Types.ObjectId(),
        stickyNoteNumber: Math.floor(Math.random() * 1000000) + 100,
        createdBy: owner._id,
        status: "ACTIVE",
    });
}
const fileInput = () => ({
    fileName: "notes.txt",
    mimeType: "text/plain",
    size: 40,
    idempotencyKey: String(new Types.ObjectId()),
});
async function uploadAttachment(note, user = userA) {
    const result = await attachments.requestUpload(String(note._id), String(user._id), fileInput());
    const media = await MediaModel.findById(result.mediaId);
    mockStorageObjects.set(media.storageKey, { size: 40, mimeType: "text/plain" });
    return { result, media };
}

test("attachment requests are idempotent, scoped to owner account, private, and completed once", async () => {
    const note = await newNote();
    const data = fileInput();
    const [first, second] = await Promise.all([
        attachments.requestUpload(String(note._id), String(userA._id), data),
        attachments.requestUpload(String(note._id), String(userA._id), data),
    ]);
    assert.equal(first.mediaId, second.mediaId);
    assert.equal(first.storageKey, undefined);
    assert.equal(first.requiredHeaders["If-None-Match"], "*");
    const media = await MediaModel.findById(first.mediaId);
    assert.equal(String(media.tenantId), String(userA._id));
    assert.equal(String(media.workspaceId), String(workspaceA._id));
    assert.equal(media.bucket, "media-test-private");
    assert.equal(media.visibility, "PRIVATE");
    assert.match(media.storageKey, /tenants\/.*\/workspaces\/.*\/notes\/.*\/attachments\//);
    await assert.rejects(() => attachments.download(String(note._id), first.mediaId, String(userA._id)));
    mockStorageObjects.set(media.storageKey, { size: 40, mimeType: "text/plain" });
    const completed = await Promise.all([
        attachments.complete(String(note._id), first.mediaId, String(userA._id)),
        attachments.complete(String(note._id), first.mediaId, String(userA._id)),
    ]);
    assert.ok(completed.every((row) => row.status === "ACTIVE"));
    assert.equal((await attachments.list(String(note._id), String(userA._id), {})).total, 1);
    await assert.rejects(
        () => attachments.requestUpload(String(note._id), String(userA._id), { ...data, size: 41 }),
        { statusCode: 409 },
    );
});

test("attachment and generic APIs reject cross-tenant access, resource tampering and reassignment", async () => {
    const note = await newNote();
    const other = await newNote();
    const { result } = await uploadAttachment(note);
    await attachments.complete(String(note._id), result.mediaId, String(userA._id));
    for (const action of [
        () => attachments.download(String(note._id), result.mediaId, String(userB._id)),
        () => mediaService.getMedia(result.mediaId, String(userB._id)),
        () => mediaService.completeUpload(result.mediaId, String(userB._id)),
        () => mediaService.deleteMedia(result.mediaId, String(userB._id)),
        () => mediaService.getMediaFiles(String(userB._id), { resourceType: "NOTE", resourceId: note._id }),
        () => attachments.complete(String(other._id), result.mediaId, String(userA._id)),
        () => attachments.download(String(other._id), result.mediaId, String(userA._id)),
        () => mediaService.updateMedia(result.mediaId, String(userA._id), { resourceId: other._id }),
        () => mediaService.updateMedia(result.mediaId, String(userA._id), { visibility: "PUBLIC" }),
    ])
        await assert.rejects(action);
    const token = JwtUtil.generateAccessToken(String(userA._id), String(new Types.ObjectId()));
    const response = await fetch(`${baseUrl}/stickynotes/${note._id}/attachments/request-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            ...fileInput(),
            tenantId: String(userB._id),
            workspaceId: String(workspaceA._id),
        }),
    });
    assert.equal(response.status, 400);
    await attachments.delete(String(note._id), result.mediaId, String(userA._id));
    await assert.rejects(() => mediaService.getDownloadUrl(result.mediaId, String(userA._id)), {
        statusCode: 404,
    });
});

test("note archive retains files, trash blocks access, restore recovers, purge schedules deletion", async () => {
    const note = await newNote();
    const { result, media } = await uploadAttachment(note);
    await attachments.complete(String(note._id), result.mediaId, String(userA._id));
    await StickyNoteModel.updateOne({ _id: note._id }, { status: "ARCHIVED" });
    assert.equal((await attachments.list(String(note._id), String(userA._id), {})).total, 1);
    await StickyNoteModel.updateOne({ _id: note._id }, { status: "TRASHED" });
    await assert.rejects(() => attachments.list(String(note._id), String(userA._id), {}));
    await assert.rejects(() => mediaService.getDownloadUrl(result.mediaId, String(userA._id)));
    await assert.rejects(() => attachments.requestUpload(String(note._id), String(userA._id), fileInput()));
    assert.ok(mockStorageObjects.has(media.storageKey));
    await StickyNoteModel.updateOne({ _id: note._id }, { status: "ACTIVE" });
    assert.equal((await attachments.list(String(note._id), String(userA._id), {})).total, 1);
    await StickyNoteModel.updateOne({ _id: note._id }, { status: "TRASHED" });
    const { StickyNotePurgeService } =
        await import("../src/modules/stickynotes/services/stickyNotePurge.service.ts");
    await new StickyNotePurgeService().purgeById(String(note._id));
    const tombstone = await MediaModel.findById(result.mediaId);
    assert.equal(tombstone.status, "DELETED");
    assert.equal(tombstone.storageDeletionPending, true);
});

test("content rejection quarantines files and failed deletions retain retry state", async () => {
    const note = await newNote();
    const { result } = await uploadAttachment(note);
    const { MediaContentService } = await import("../src/modules/media/services/mediaContent.service.ts");
    const verify = mock.method(MediaContentService.prototype, "verify", async () => {
        throw new Error("unsafe content");
    });
    try {
        await assert.rejects(() => attachments.complete(String(note._id), result.mediaId, String(userA._id)));
    } finally {
        verify.mock.restore();
    }
    assert.equal((await MediaModel.findById(result.mediaId)).status, "FAILED");
    assert.equal((await attachments.list(String(note._id), String(userA._id), {})).total, 0);
    await MediaModel.updateOne({ _id: result.mediaId }, { uploadUrlExpiresAt: new Date(0) });
    storageFails = true;
    try {
        assert.ok((await mediaService.cleanupPendingStorageDeletions()).failed > 0);
    } finally {
        storageFails = false;
    }
    assert.ok(await MediaModel.findById(result.mediaId));
    await mediaService.cleanupPendingStorageDeletions();
    assert.equal(await MediaModel.findById(result.mediaId), null);
});

test("concurrent attachment admissions honor note count and total byte limits", async () => {
    const { FeatureModel } = await import("../src/modules/feature/models/feature.model.ts");
    const { PlanFeatureModel } = await import("../src/modules/planfeature/models/planfeature.model.ts");
    const feature = await FeatureModel.findOne({ code: "MAX_ATTACHMENTS_PER_NOTE" });
    await PlanFeatureModel.updateMany({ featureId: feature._id }, { limit: 1, isUnlimited: false });
    const note = await newNote();
    try {
        const results = await Promise.allSettled(
            Array.from({ length: 4 }, () =>
                attachments.requestUpload(String(note._id), String(userA._id), fileInput()),
            ),
        );
        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(await MediaModel.countDocuments({ resourceId: note._id }), 1);
    } finally {
        await PlanFeatureModel.updateMany({ featureId: feature._id }, { isUnlimited: true });
    }
    const storageFeature = await FeatureModel.findOne({ code: "MAX_STORAGE_BYTES" });
    const owner = await createTestUser("quota");
    const workspace = await WorkspaceModel.create({
        name: "Quota",
        slug: `quota-${owner._id}`,
        ownerId: owner._id,
    });
    const notes = await Promise.all([newNote(owner, workspace), newNote(owner, workspace)]);
    await PlanFeatureModel.updateMany({ featureId: storageFeature._id }, { limit: 60, isUnlimited: false });
    try {
        const results = await Promise.allSettled(
            notes.map((note) => attachments.requestUpload(String(note._id), String(owner._id), fileInput())),
        );
        assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    } finally {
        await PlanFeatureModel.updateMany({ featureId: storageFeature._id }, { isUnlimited: true });
    }
});

test("legacy ownership resolution preserves keys and refuses orphaned or conflicting relationships", async () => {
    const { resolveLegacyMediaOwnership } =
        await import("../src/modules/media/services/mediaMigration.service.ts");
    const note = await newNote();
    const row = {
        uploadedBy: userA._id,
        storageKey: "stickyji/legacy/file.txt",
        resourceType: "NOTE",
        resourceId: note._id,
    };
    const result = await resolveLegacyMediaOwnership(row);
    assert.equal(String(result.tenantId), String(userA._id));
    assert.deepEqual(await resolveLegacyMediaOwnership({ ...row, ...result }), result);
    assert.equal(row.storageKey, "stickyji/legacy/file.txt");
    await assert.rejects(() => resolveLegacyMediaOwnership({ ...row, resourceId: new Types.ObjectId() }));
    await assert.rejects(() => resolveLegacyMediaOwnership({ ...row, tenantId: userB._id }));
});

test("workspace readers can download but cannot write; removed uploaders lose generic Media access", async () => {
    const { PermissionModel } = await import("../src/modules/permissions/models/permission.model.ts");
    const { RoleModel } = await import("../src/modules/roles/models/role.model.ts");
    const { WorkspaceMemberModel } =
        await import("../src/modules/workspaceMember/models/workspaceMember.model.ts");
    const permission = await PermissionModel.create({
        name: "attachment reader",
        displayName: "Attachment reader",
        code: "TEST_ATTACHMENT_READ",
        module: "NOTES",
        action: "READ",
        access: "ANY",
    });
    const role = await RoleModel.create({
        name: "attachment reader",
        displayName: "Attachment reader",
        code: "TEST_ATTACHMENT_READER",
        scope: "WORKSPACE",
        workspaceId: workspaceA._id,
        permissions: [permission._id],
        isActive: true,
    });
    const membership = await WorkspaceMemberModel.create({
        userId: userB._id,
        workspaceId: workspaceA._id,
        roleId: role._id,
        status: "ACTIVE",
    });
    const note = await newNote();
    const { result } = await uploadAttachment(note);
    await attachments.complete(String(note._id), result.mediaId, String(userA._id));
    assert.ok((await attachments.download(String(note._id), result.mediaId, String(userB._id))).downloadUrl);
    for (const action of [
        () => attachments.requestUpload(String(note._id), String(userB._id), fileInput()),
        () => attachments.complete(String(note._id), result.mediaId, String(userB._id)),
        () => attachments.delete(String(note._id), result.mediaId, String(userB._id)),
    ])
        await assert.rejects(action, { statusCode: 403 });
    const update = await PermissionModel.create({
        name: "attachment editor",
        displayName: "Attachment editor",
        code: "TEST_ATTACHMENT_UPDATE",
        module: "NOTES",
        action: "UPDATE",
        access: "ANY",
    });
    await RoleModel.updateOne({ _id: role._id }, { $push: { permissions: update._id } });
    const ownUpload = await uploadAttachment(note, userB);
    await WorkspaceMemberModel.deleteOne({ _id: membership._id });
    await assert.rejects(() => mediaService.completeUpload(ownUpload.result.mediaId, String(userB._id)));
    await assert.rejects(() => mediaService.getMedia(ownUpload.result.mediaId, String(userB._id)));
    await assert.rejects(() => mediaService.getDownloadUrl(result.mediaId, String(userB._id)));
});

test("ownership migration CLI dry-run, repeat apply and guarded rollback preserve legacy objects", async () => {
    const note = await newNote();
    const id = new Types.ObjectId();
    const legacy = await MediaModel.create({ _id: id, uploadedBy: userA._id, bucket: "media-test",
        storageKey: `legacy/${id}.txt`, originalFileName: "legacy.txt", mimeType: "text/plain", size: 40,
        mediaType: "DOCUMENT", purpose: "ATTACHMENT", resourceType: "NOTE", resourceId: note._id, status: "ACTIVE" });
    const directory = await mkdtemp(join(tmpdir(), "media-migration-test-"));
    const journal = join(directory, "journal.jsonl");
    const previousId = (BigInt(`0x${id}`) - 1n).toString(16).padStart(24, "0");
    const run = (...args) => promisify(execFile)(process.execPath,
        ["--import", "tsx", "src/scripts/migrate-media-ownership.ts", ...args],
        { windowsHide: true, env: { ...process.env, MONGO_URI: `mongodb://127.0.0.1:${mongoose.connection.port}/${mongoose.connection.name}?directConnection=true` } });
    try {
        await run("--dry-run", `--after=${previousId}`);
        assert.equal((await MediaModel.findById(id)).tenantId, null);
        await run("--apply", `--journal=${journal}`, `--after=${previousId}`);
        assert.equal(String((await MediaModel.findById(id)).tenantId), String(userA._id));
        assert.equal((await MediaModel.findById(id)).storageKey, legacy.storageKey);
        const repeat = await run("--apply", `--journal=${journal}`, `--after=${previousId}`);
        assert.ok(!repeat.stdout.includes('"action":"backfilled"'));
        await run(`--rollback=${journal}`, "--dry-run");
        assert.equal(String((await MediaModel.findById(id)).tenantId), String(userA._id));
        await run(`--rollback=${journal}`, "--apply");
        assert.equal((await MediaModel.findById(id)).tenantId, null);
        assert.equal((await MediaModel.findById(id)).storageKey, legacy.storageKey);
        await assert.rejects(() => run("--apply", "--dry-run", `--journal=${journal}`));
    } finally { await rm(directory, { recursive: true, force: true }); }
});
