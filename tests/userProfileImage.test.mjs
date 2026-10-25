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

process.env.JWT_ACCESS_SECRET = "profile-image-test-access-secret";
process.env.JWT_REFRESH_SECRET = "profile-image-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "profile-image-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
    MediaStorageProvider,
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
let storageFails = false;
const mockStorageObjects = new Map();

// Mock CloudflareR2Service network operations
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

async function createAndVerifyMedia(user, fileName = "profile.jpg", mimeType = "image/jpeg", size = 1024 * 100) {
    const requested = await mediaService.requestUpload(
        {
            fileName,
            mimeType,
            size,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.PROFILE_IMAGE,
            resourceType: MediaResourceType.USER,
            resourceId: user._id.toString(),
            visibility: MediaVisibility.PRIVATE,
        },
        user._id.toString(),
        { actorId: user._id.toString() },
    );

    mockStorageObjects.set(requested.media.storageKey, {
        size,
        mimeType,
    });

    const confirmed = await mediaService.completeUpload(
        requested.media.id,
        user._id.toString(),
        { actorId: user._id.toString() },
    );

    return confirmed;
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "profile-img-test-"));
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
            "profileImgTestSet",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/profile_img_test?directConnection=true`, {
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
        replSetInitiate: { _id: "profileImgTestSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
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

test("1. First profile image upload: request upload, confirm, and attach to profile", async () => {
    // 1. Request profile image upload URL
    const uploadReqRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "avatar.png",
            mimeType: "image/png",
            size: 1024 * 50,
        }),
    });

    assert.equal(uploadReqRes.status, 201);
    const uploadReqBody = await uploadReqRes.json();
    assert.equal(uploadReqBody.success, true);
    assert.ok(uploadReqBody.data.uploadUrl);
    assert.ok(uploadReqBody.data.mediaId);
    const mediaId = uploadReqBody.data.mediaId;

    // Simulate R2 upload
    mockStorageObjects.set(uploadReqBody.data.storageKey, {
        size: 1024 * 50,
        mimeType: "image/png",
    });

    // Complete upload via Media API
    const confirmRes = await fetch(`${baseUrl}/media/${mediaId}/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({}),
    });
    assert.equal(confirmRes.status, 200);

    // Set profile image
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
    assert.equal(setBody.success, true);
    assert.equal(setBody.data.profileImage?.id, mediaId);
    assert.ok(setBody.data.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(setBody.data.avatarUrl.includes("mock-r2.test/download"));

    // Verify DB state
    const updatedProfile = await UserProfileModel.findById(userAProfile._id);
    assert.equal(updatedProfile.profileImage.toString(), mediaId);
});

test("2. Successful image replacement replaces reference and cleans up old image", async () => {
    let currentProfile = await UserProfileModel.findById(userAProfile._id);
    if (!currentProfile.profileImage) {
        const initMedia = await createAndVerifyMedia(userA, "avatar1.jpg", "image/jpeg", 1024 * 50);
        await fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: initMedia.id }),
        });
        currentProfile = await UserProfileModel.findById(userAProfile._id);
    }
    const oldMediaId = currentProfile.profileImage.toString();

    // Create and confirm a new image for User A
    const newMedia = await createAndVerifyMedia(userA, "avatar2.jpg", "image/jpeg", 1024 * 60);

    // Replace profile image
    const replaceRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: newMedia.id }),
    });

    assert.equal(replaceRes.status, 200);
    const replaceBody = await replaceRes.json();
    assert.equal(replaceBody.data.profileImage?.id, newMedia.id);

    // Allow async cleanup to settle
    await delay(100);

    // Check old media was cleaned up (marked DELETED or deleted from DB)
    const oldMedia = await MediaModel.findById(oldMediaId);
    assert.ok(!oldMedia || oldMedia.status === MediaStatus.DELETED || oldMedia.isDeleted);
});

test("3. Image removal clears profile image and marks previous image for cleanup", async () => {
    let profileBefore = await UserProfileModel.findById(userAProfile._id);
    if (!profileBefore.profileImage) {
        const initMedia = await createAndVerifyMedia(userA, "avatar_to_remove.jpg", "image/jpeg", 1024 * 50);
        await fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: initMedia.id }),
        });
        profileBefore = await UserProfileModel.findById(userAProfile._id);
    }
    const activeMediaId = profileBefore.profileImage.toString();

    const removeRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(removeRes.status, 200);
    const removeBody = await removeRes.json();
    assert.equal(removeBody.success, true);
    assert.equal(removeBody.data.profileImage, null);
    assert.equal(removeBody.data.avatarUrl, null);

    // Allow async cleanup to settle
    await delay(100);

    // Verify DB profile reference is null
    const profileAfter = await UserProfileModel.findById(userAProfile._id);
    assert.equal(profileAfter.profileImage, null);

    // Verify previous media is cleaned up
    const deletedMedia = await MediaModel.findById(activeMediaId);
    assert.ok(!deletedMedia || deletedMedia.status === MediaStatus.DELETED || deletedMedia.isDeleted);
});

test("4. Invalid file format is rejected (SVG, GIF, PDF)", async () => {
    // Attempt SVG
    const svgRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "exploit.svg",
            mimeType: "image/svg+xml",
            size: 1024,
        }),
    });
    assert.equal(svgRes.status, 400);

    // Attempt GIF
    const gifRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "animated.gif",
            mimeType: "image/gif",
            size: 1024,
        }),
    });
    assert.equal(gifRes.status, 400);

    // Attempt PDF
    const pdfRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "document.pdf",
            mimeType: "application/pdf",
            size: 1024,
        }),
    });
    assert.equal(pdfRes.status, 400);
});

test("5. Oversized image (> 5MB) is rejected", async () => {
    const oversizedRes = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "huge.png",
            mimeType: "image/png",
            size: 6 * 1024 * 1024, // 6 MB
        }),
    });
    assert.equal(oversizedRes.status, 400);
});

test("6. Failed R2 upload confirmation preserves current state", async () => {
    // Request upload
    const requested = await mediaService.requestUpload(
        {
            fileName: "failed-upload.png",
            mimeType: "image/png",
            size: 1024 * 10,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.PROFILE_IMAGE,
            resourceType: MediaResourceType.USER,
            resourceId: userA._id.toString(),
            visibility: MediaVisibility.PRIVATE,
        },
        userA._id.toString(),
        { actorId: userA._id.toString() },
    );

    // Do NOT put in mockStorageObjects (simulating missing upload in R2)
    await assert.rejects(
        async () => {
            await mediaService.completeUpload(
                requested.media.id,
                userA._id.toString(),
                { actorId: userA._id.toString() },
            );
        },
        (err) =>
            err.message.includes("Storage object not found") ||
            err.message.includes("Media file was not uploaded") ||
            err.message.includes("Uploaded file was not found"),
    );

    // Confirm that the media record did not become ACTIVE
    const mediaDoc = await MediaModel.findById(requested.media.id);
    assert.notEqual(mediaDoc.status, MediaStatus.ACTIVE);
});

test("7. Failed Media confirmation: Pending media cannot be set as profile image", async () => {
    // Create pending media without confirming
    const requested = await mediaService.requestUpload(
        {
            fileName: "pending.jpg",
            mimeType: "image/jpeg",
            size: 1024 * 20,
            mediaType: MediaType.IMAGE,
            purpose: MediaPurpose.PROFILE_IMAGE,
            resourceType: MediaResourceType.USER,
            resourceId: userA._id.toString(),
            visibility: MediaVisibility.PRIVATE,
        },
        userA._id.toString(),
        { actorId: userA._id.toString() },
    );

    const setRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: requested.media.id }),
    });

    assert.equal(setRes.status, 400);
    const body = await setRes.json();
    assert.ok(body.message.includes("active") || body.message.includes("verified"));
});

test("8. Failed profile reference update preserves previous state", async () => {
    // Set a valid image first
    const validMedia = await createAndVerifyMedia(userA, "initial.jpg", "image/jpeg", 1024 * 30);
    await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: validMedia.id }),
    });

    const profileBefore = await UserProfileModel.findById(userAProfile._id);
    assert.equal(profileBefore.profileImage.toString(), validMedia.id);

    // Attempt to set a non-existent media ID
    const randomMediaId = new Types.ObjectId().toString();
    const failRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: randomMediaId }),
    });

    assert.equal(failRes.status, 404);

    // Profile reference must remain untouched
    const profileAfter = await UserProfileModel.findById(userAProfile._id);
    assert.equal(profileAfter.profileImage.toString(), validMedia.id);
});

test("9. Profile image retrieval returns authorized download URL", async () => {
    // User A already has validMedia attached from test 8
    const getRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(getRes.status, 200);
    const body = await getRes.json();
    assert.ok(body.data.profileImage?.id);
    assert.ok(body.data.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(body.data.avatarUrl.includes("mock-r2.test/download"));
});

test("10. User with no profile image returns null fields", async () => {
    // User B has not set any profile image
    const getRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userBToken}`,
        },
    });

    assert.equal(getRes.status, 200);
    const body = await getRes.json();
    assert.equal(body.data.profileImage, null);
    assert.equal(body.data.avatarUrl, null);

    // Also verify /userprofile/me
    const meRes = await fetch(`${baseUrl}/userprofile/me`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userBToken}`,
        },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.data.profileImage, null);
    assert.equal(meBody.data.avatarUrl, null);
});

test("11. Unauthorized update attempt is rejected", async () => {
    const unauthRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaId: new Types.ObjectId().toString() }),
    });
    assert.equal(unauthRes.status, 401);

    const unauthDeleteRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "DELETE",
    });
    assert.equal(unauthDeleteRes.status, 401);
});

test("12. Attempt to attach another user's media is forbidden", async () => {
    // User B creates a verified media
    const userBMedia = await createAndVerifyMedia(userB, "userb.png", "image/png", 1024 * 40);

    // User A tries to attach User B's media
    const attackRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: userBMedia.id }),
    });

    assert.equal(attackRes.status, 403);
    const attackBody = await attackRes.json();
    assert.ok(attackBody.message.includes("You can only attach your own media files"));
});

test("13. Attempt to attach deleted media is rejected", async () => {
    // User A creates a verified media, then deletes it
    const mediaToDel = await createAndVerifyMedia(userA, "todelete.jpg", "image/jpeg", 1024 * 15);
    await mediaService.deleteMedia(mediaToDel.id, userA._id.toString(), { actorId: userA._id.toString() });

    // User A attempts to set deleted media as profile image
    const setRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: mediaToDel.id }),
    });

    assert.ok([400, 404].includes(setRes.status));
    const setBody = await setRes.json();
    assert.ok(
        /invalid|active|verified|not found/i.test(setBody.message),
    );
});

test("14. Concurrent image replacement resolves safely without corrupted state", async () => {
    const media1 = await createAndVerifyMedia(userA, "concurrent1.webp", "image/webp", 1024 * 25);
    const media2 = await createAndVerifyMedia(userA, "concurrent2.webp", "image/webp", 1024 * 26);

    const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: media1.id }),
        }),
        fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: media2.id }),
        }),
    ]);

    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);

    // Settle async cleanup
    await delay(150);

    // User A's profile must reference one of the two media IDs cleanly
    const finalProfile = await UserProfileModel.findById(userAProfile._id);
    const finalMediaId = finalProfile.profileImage.toString();
    assert.ok(finalMediaId === media1.id || finalMediaId === media2.id);

    // The winning media must be ACTIVE
    const winningMedia = await MediaModel.findById(finalMediaId);
    assert.equal(winningMedia.status, MediaStatus.ACTIVE);
});

test("15. Cleanup of previously replaced images removes storage and metadata", async () => {
    let currentProfile = await UserProfileModel.findById(userAProfile._id);
    if (!currentProfile.profileImage) {
        const initMedia = await createAndVerifyMedia(userA, "temp.jpg", "image/jpeg", 1024 * 20);
        await fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: initMedia.id }),
        });
        currentProfile = await UserProfileModel.findById(userAProfile._id);
    }
    const mediaToReplace = currentProfile.profileImage.toString();

    const newerMedia = await createAndVerifyMedia(userA, "final.jpg", "image/jpeg", 1024 * 35);

    const replaceRes = await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId: newerMedia.id }),
    });
    assert.equal(replaceRes.status, 200);

    await delay(150);

    // Check old media was cleaned up
    const oldMedia = await MediaModel.findById(mediaToReplace);
    assert.ok(!oldMedia || oldMedia.status === MediaStatus.DELETED || oldMedia.isDeleted);
});

test("16. Existing user profile functionality remains unaffected", async () => {
    // Ensure User A has an active profile image
    let currentProfile = await UserProfileModel.findById(userAProfile._id);
    if (!currentProfile.profileImage) {
        const baseMedia = await createAndVerifyMedia(userA, "base.jpg", "image/jpeg", 1024 * 20);
        await fetch(`${baseUrl}/userprofile/image`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${userAToken}`,
            },
            body: JSON.stringify({ mediaId: baseMedia.id }),
        });
    }

    // Test update profile with standard fields
    const updateRes = await fetch(`${baseUrl}/userprofile/update`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            displayName: "Updated Display Name",
            bio: "Updated bio for test",
        }),
    });

    assert.equal(updateRes.status, 200);
    const updateBody = await updateRes.json();
    assert.equal(updateBody.data.displayName, "Updated Display Name");
    assert.equal(updateBody.data.bio, "Updated bio for test");
    // Verify profile image is preserved during profile field update
    assert.ok(updateBody.data.profileImage?.id);

    // Test get me
    const meRes = await fetch(`${baseUrl}/userprofile/me`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });
    assert.equal(meRes.status, 200);
    const meBody = await meRes.json();
    assert.equal(meBody.data.displayName, "Updated Display Name");
    assert.ok(meBody.data.profileImage?.id);

    // Test get all profiles
    const allRes = await fetch(`${baseUrl}/userprofile/getall?page=1&limit=10`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });
    assert.equal(allRes.status, 200);
    const allBody = await allRes.json();
    assert.ok(Array.isArray(allBody.data));
    assert.ok(allBody.data.length >= 2);
});
