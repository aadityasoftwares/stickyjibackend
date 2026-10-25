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

process.env.JWT_ACCESS_SECRET = "member-img-test-access-secret";
process.env.JWT_REFRESH_SECRET = "member-img-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "member-img-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { WorkspaceMemberModel } = await import("../src/modules/workspaceMember/models/workspaceMember.model.ts");
const { RoleModel } = await import("../src/modules/roles/models/role.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
} = await import("../src/modules/media/constants/media.enums.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: workspaceMemberRoutes } = await import("../src/modules/workspaceMember/routes/workspaceMember.routes.ts");
const { default: userProfileRoutes } = await import("../src/modules/userprofile/routes/userProfile.routes.ts");
const { default: mediaRoutes } = await import("../src/modules/media/routes/media.routes.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let userA, userB;
let userAToken, userBToken;
let userAProfile, userBProfile;
let testWorkspace;
let ownerRole, memberRole;
const mockStorageObjects = new Map();

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

    mongoDirectory = await mkdtemp(join(tmpdir(), "member-img-test-"));
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
            "memberImgSet",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/member_img_test?directConnection=true`, {
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
        replSetInitiate: { _id: "memberImgSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();
    await MediaModel.createIndexes();
    await UserProfileModel.createIndexes();
    await WorkspaceMemberModel.createIndexes();

    const createdA = await createTestUser("usera");
    userA = createdA.user;
    userAProfile = createdA.profile;
    userAToken = JwtUtil.generateAccessToken(userA._id.toString(), new Types.ObjectId().toString());

    const createdB = await createTestUser("userb");
    userB = createdB.user;
    userBProfile = createdB.profile;
    userBToken = JwtUtil.generateAccessToken(userB._id.toString(), new Types.ObjectId().toString());

    testWorkspace = await WorkspaceModel.create({
        name: "Test Workspace",
        slug: "test-workspace",
        ownerId: userA._id,
        status: "ACTIVE",
    });

    ownerRole = await RoleModel.create({
        name: "Owner",
        code: "WORKSPACE_OWNER",
        displayName: "Workspace Owner",
        scope: "WORKSPACE",
        workspaceId: testWorkspace._id,
        isSystem: true,
        isActive: true,
    });

    memberRole = await RoleModel.create({
        name: "Member",
        code: "WORKSPACE_MEMBER",
        displayName: "Workspace Member",
        scope: "WORKSPACE",
        workspaceId: testWorkspace._id,
        isSystem: true,
        isActive: true,
    });

    // Add User A as owner member
    await WorkspaceMemberModel.create({
        workspaceId: testWorkspace._id,
        userId: userA._id,
        roleId: ownerRole._id,
        status: "ACTIVE",
        joinedAt: new Date(),
    });

    // Add User B as member invited by User A
    await WorkspaceMemberModel.create({
        workspaceId: testWorkspace._id,
        userId: userB._id,
        roleId: memberRole._id,
        status: "ACTIVE",
        invitedBy: userA._id,
        joinedAt: new Date(),
    });

    const app = express();
    app.use(express.json());
    app.use("/workspacemembers", workspaceMemberRoutes);
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

test("1. Member without profile image returns null profileImage and avatarUrl in member list", async () => {
    const res = await fetch(`${baseUrl}/workspacemembers/getall?workspaceId=${testWorkspace._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 2);

    const memberB = body.data.find((m) => m.user.id === userB._id.toString());
    assert.ok(memberB);
    assert.equal(memberB.user.profileImage, null);
    assert.equal(memberB.user.avatarUrl, null);
});

test("2. Member with profile image returns populated profileImage and avatarUrl in member list", async () => {
    // 1. Upload and attach a profile image for User A
    const uploadReq = await fetch(`${baseUrl}/userprofile/image/upload-request`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
            fileName: "usera-photo.png",
            mimeType: "image/png",
            size: 1024 * 50,
        }),
    });

    const uploadBody = await uploadReq.json();
    const mediaId = uploadBody.data.mediaId;

    mockStorageObjects.set(uploadBody.data.storageKey, {
        size: 1024 * 50,
        mimeType: "image/png",
    });

    await fetch(`${baseUrl}/media/${mediaId}/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({}),
    });

    await fetch(`${baseUrl}/userprofile/image`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ mediaId }),
    });

    // 2. Fetch workspace members list
    const res = await fetch(`${baseUrl}/workspacemembers/getall?workspaceId=${testWorkspace._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // User A (member) should have profileImage and avatarUrl populated
    const memberA = body.data.find((m) => m.user.id === userA._id.toString());
    assert.ok(memberA);
    assert.equal(memberA.user.profileImage?.id, mediaId);
    assert.ok(memberA.user.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(memberA.user.avatarUrl.includes("mock-r2.test/download"));

    // User B was invited by User A, so addedBy should also reflect User A's profile image!
    const memberB = body.data.find((m) => m.user.id === userB._id.toString());
    assert.ok(memberB);
    assert.ok(memberB.addedBy);
    assert.equal(memberB.addedBy.id, userA._id.toString());
    assert.equal(memberB.addedBy.profileImage?.id, mediaId);
    assert.ok(memberB.addedBy.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(memberB.addedBy.avatarUrl.includes("mock-r2.test/download"));
});

test("3. Single member query (getWorkspaceMemberById) returns populated profile with profileImage and avatarUrl", async () => {
    const memberDoc = await WorkspaceMemberModel.findOne({
        workspaceId: testWorkspace._id,
        userId: userA._id,
    });

    const res = await fetch(`${baseUrl}/workspacemembers/get/${memberDoc._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${userAToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.profile);
    assert.ok(body.data.profile.profileImage?.id);
    assert.ok(body.data.profile.profileImage?.url.includes("mock-r2.test/download"));
    assert.ok(body.data.profile.avatarUrl.includes("mock-r2.test/download"));
});
