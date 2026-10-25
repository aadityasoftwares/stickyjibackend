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

process.env.JWT_ACCESS_SECRET = "ws-img-test-access-secret";
process.env.JWT_REFRESH_SECRET = "ws-img-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "ws-img-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { WorkspaceMemberModel } = await import("../src/modules/workspaceMember/models/workspaceMember.model.ts");
const { WorkspaceFolderModel } = await import("../src/modules/workspaceFolders/models/workspaceFolder.model.ts");
const { RoleModel } = await import("../src/modules/roles/models/role.model.ts");
const { PermissionModel } = await import("../src/modules/permissions/models/permission.model.ts");
const { MediaModel } = await import("../src/modules/media/models/media.model.ts");
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const {
    MediaStatus,
    MediaType,
    MediaPurpose,
    MediaVisibility,
    MediaResourceType,
} = await import("../src/modules/media/constants/media.enums.js");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: workspaceRoutes } = await import("../src/modules/workspace/routes/workspace.routes.ts");
const { SYSTEM_ROLE_CODES } = await import("../src/modules/roles/constants/role.constants.ts");
const { RoleScope, RoleType } = await import("../src/modules/roles/constants/role.enums.ts");
const {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} = await import("../src/modules/permissions/constants/permission.enums.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let ownerUser, memberUser;
let ownerToken, memberToken;
let ownerProfile, memberProfile;
let ownerMedia;
let testWorkspace, testFolder;
let ownerRole, memberRole;

CloudflareR2Service.prototype.createDownloadUrl = async function (storageKey, expiresIn = 900) {
    return `https://mock-r2.test/download/${storageKey}?expires=${expiresIn}`;
};

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "ws-img-test-"));
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
            "wsImgSet",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/ws_img_test?directConnection=true`, {
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
        replSetInitiate: { _id: "wsImgSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();

    const app = express();
    app.use(express.json());
    app.use("/api/v1/workspaces", workspaceRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/workspaces`;

    const allPerms = await PermissionModel.find({}).lean();
    const readPerm = allPerms.find((p) => p.module === PermissionModule.WORKSPACE && p.action === PermissionAction.READ);

    ownerRole = await RoleModel.create({
        name: "Workspace Owner",
        displayName: "Workspace Owner",
        code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER,
        scope: RoleScope.WORKSPACE,
        type: RoleType.SYSTEM,
        description: "Owner role",
        permissions: allPerms.map((p) => ({
            permissionId: p._id,
            access: PermissionAccess.ALL,
        })),
        isSystem: true,
        isActive: true,
    });

    memberRole = await RoleModel.create({
        name: "Workspace Member",
        displayName: "Workspace Member",
        code: SYSTEM_ROLE_CODES.WORKSPACE_MEMBER,
        scope: RoleScope.WORKSPACE,
        type: RoleType.SYSTEM,
        description: "Member role",
        permissions: readPerm
            ? [{ permissionId: readPerm._id, access: PermissionAccess.ALL }]
            : [],
        isSystem: true,
        isActive: true,
    });

    ownerUser = await UserModel.create({
        email: `wsowner-${Date.now()}@test.com`,
        displayName: "Alice Owner",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });

    memberUser = await UserModel.create({
        email: `wsmember-${Date.now()}@test.com`,
        displayName: "Bob Member",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
        isDeleted: false,
    });

    ownerToken = JwtUtil.generateAccessToken(ownerUser._id.toString(), new Types.ObjectId().toString());
    memberToken = JwtUtil.generateAccessToken(memberUser._id.toString(), new Types.ObjectId().toString());

    ownerMedia = await MediaModel.create({
        uploadedBy: ownerUser._id,
        mediaType: MediaType.IMAGE,
        originalFileName: "alice-photo.png",
        bucket: "ws-img-test",
        mimeType: "image/png",
        size: 2048,
        purpose: MediaPurpose.PROFILE_IMAGE,
        visibility: MediaVisibility.PRIVATE,
        status: MediaStatus.READY,
        storageKey: `user/avatars/${ownerUser._id}/2026/alice-photo-hash.png`,
        resourceType: MediaResourceType.USER,
        resourceId: ownerUser._id,
        isConfirmed: true,
    });

    ownerProfile = await UserProfileModel.create({
        userId: ownerUser._id,
        displayName: "Alice Owner",
        firstName: "Alice",
        lastName: "Owner",
        profileImage: ownerMedia._id,
        profileType: "PERSONAL",
        status: "ACTIVE",
        isDeleted: false,
    });

    memberProfile = await UserProfileModel.create({
        userId: memberUser._id,
        displayName: "Bob Member",
        firstName: "Bob",
        lastName: "Member",
        profileImage: null,
        profileType: "PERSONAL",
        status: "ACTIVE",
        isDeleted: false,
    });

    testWorkspace = await WorkspaceModel.create({
        name: "Test Space",
        slug: `test-space-${Date.now()}`,
        ownerId: ownerUser._id,
        status: "ACTIVE",
        visibility: "PRIVATE",
        isPersonal: false,
        createdBy: ownerUser._id,
        updatedBy: ownerUser._id,
    });

    await WorkspaceMemberModel.create({
        workspaceId: testWorkspace._id,
        userId: memberUser._id,
        roleId: memberRole._id,
        status: "ACTIVE",
        joinedAt: new Date(),
    });

    testFolder = await WorkspaceFolderModel.create({
        workspaceId: testWorkspace._id,
        name: "General",
        slug: "general",
        position: 0,
        isDefault: true,
        status: "ACTIVE",
    });
});

after(async () => {
    if (server) await new Promise((res) => server.close(res));
    await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) {
        const stopped = once(mongoProcess, "exit");
        mongoProcess.kill();
        await stopped;
    }
    if (mongoDirectory) {
        await rm(mongoDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("1. GET /workspaces/getall returns profileImage and avatarUrl in summary.members and owner", async () => {
    const res = await fetch(`${baseUrl}/getall`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${ownerToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));

    const ws = body.data.find((w) => w.id === testWorkspace._id.toString());
    assert.ok(ws, "Workspace should be present in results");

    // Owner checks
    assert.ok(ws.owner);
    assert.equal(ws.owner.id, ownerUser._id.toString());
    assert.equal(ws.owner.displayName, "Alice Owner");
    assert.ok(ws.owner.profileImage);
    assert.equal(ws.owner.profileImage.id, ownerMedia._id.toString());
    assert.ok(ws.owner.profileImage.url.includes("mock-r2.test/download"));
    assert.ok(ws.owner.avatarUrl.includes("mock-r2.test/download"));
    assert.equal(ws.ownerProfileImage.id, ownerMedia._id.toString());
    assert.ok(ws.ownerAvatarUrl.includes("mock-r2.test/download"));

    // summary.members checks
    assert.ok(ws.summary);
    assert.ok(Array.isArray(ws.summary.members));
    assert.equal(ws.summary.memberCount, 2);

    // Member 0: Owner preview
    const ownerPreview = ws.summary.members.find((m) => m.id === ownerUser._id.toString());
    assert.ok(ownerPreview, "Owner preview must be in summary.members");
    assert.equal(ownerPreview.isOwner, true);
    assert.equal(ownerPreview.role, "Owner");
    assert.ok(ownerPreview.profileImage);
    assert.equal(ownerPreview.profileImage.id, ownerMedia._id.toString());
    assert.ok(ownerPreview.profileImage.url.includes("mock-r2.test/download"));
    assert.ok(ownerPreview.avatarUrl.includes("mock-r2.test/download"));

    // Member 1: Invited member preview (has no profileImage)
    const memberPreview = ws.summary.members.find((m) => m.id === memberUser._id.toString());
    assert.ok(memberPreview, "Invited member must be in summary.members");
    assert.equal(memberPreview.isOwner, false);
    assert.equal(memberPreview.profileImage, null);
    assert.equal(memberPreview.avatarUrl, null);
});

test("2. GET /workspaces/get/:id returns populated owner with profileImage and avatarUrl", async () => {
    const res = await fetch(`${baseUrl}/get/${testWorkspace._id}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${ownerToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data);

    assert.ok(body.data.owner);
    assert.equal(body.data.owner.id, ownerUser._id.toString());
    assert.equal(body.data.owner.displayName, "Alice Owner");
    assert.ok(body.data.owner.profileImage);
    assert.equal(body.data.owner.profileImage.id, ownerMedia._id.toString());
    assert.ok(body.data.owner.profileImage.url.includes("mock-r2.test/download"));
    assert.ok(body.data.owner.avatarUrl.includes("mock-r2.test/download"));
    assert.equal(body.data.ownerProfileImage.id, ownerMedia._id.toString());
    assert.ok(body.data.ownerAvatarUrl.includes("mock-r2.test/download"));
});
