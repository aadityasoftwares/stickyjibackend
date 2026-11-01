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

process.env.JWT_ACCESS_SECRET = "note-img-test-access-secret";
process.env.JWT_REFRESH_SECRET = "note-img-test-refresh-secret";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    process.env[`CLOUDFLARE_R2_${key}`] = "note-img-test";
}
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://cdn.example.test";
process.env.CLOUDFLARE_R2_BUCKET_IS_PRIVATE = "false";

const { UserModel } = await import("../src/modules/user/models/user.model.ts");
const { UserProfileModel } = await import("../src/modules/userprofile/models/userProfile.model.ts");
const { WorkspaceModel } = await import("../src/modules/workspace/models/workspace.model.ts");
const { WorkspaceFolderModel } = await import("../src/modules/workspaceFolders/models/workspaceFolder.model.ts");
const { WorkspaceMemberModel } = await import("../src/modules/workspaceMember/models/workspaceMember.model.ts");
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
const { default: stickyNoteRoutes } = await import("../src/modules/stickynotes/routes/stickyNote.routes.ts");
const { StickyNoteModel } = await import("../src/modules/stickynotes/models/stickynote.model.ts");
const { StickyNoteColumnModel } = await import("../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts");
const { StickyNoteAssigneeModel } = await import("../src/modules/stickynotesassignees/models/stickyNoteAssignee.model.ts");
const { StickyNoteAssigneeStatus } = await import("../src/modules/stickynotesassignees/constants/stickyNoteAssignee.enums.js");
const {
    StickyNoteColor,
    StickyNotePriority,
    StickyNoteShape,
    StickyNoteStatus,
    StickyNoteVariant,
    StickyNoteBackgroundPattern,
} = await import("../src/modules/stickynotes/constants/stickyNote.enums.js");
const { StickyNoteColumnType, StickyNoteColumnColor } = await import("../src/modules/stickynotescolumns/constants/stickyNoteColumn.enums.js");
const {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} = await import("../src/modules/permissions/constants/permission.enums.ts");
const { SYSTEM_ROLE_CODES } = await import("../src/modules/roles/constants/role.constants.ts");
const { RoleScope, RoleType } = await import("../src/modules/roles/constants/role.enums.ts");
const { errorMiddleware } = await import("../src/middlewares/error/error.middleware.ts");
const { seedProductSubscriptionFixtures } = await import("./helpers/subscriptionFixtures.mjs");

let mongoProcess, mongoDirectory, server, baseUrl;
let creatorUser, assigneeUser;
let creatorToken, assigneeToken;
let creatorProfile, assigneeProfile;
let creatorMedia, assigneeMedia;
let testWorkspace, testFolder, testColumn, testNote;
let ownerRole;

CloudflareR2Service.prototype.createDownloadUrl = async function (storageKey, expiresIn = 900) {
    return `https://mock-r2.test/download/${storageKey}?expires=${expiresIn}`;
};

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "sticky-note-img-test-"));
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
            "noteImgReplSet",
            "--logpath",
            join(mongoDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongoProcess.on("error", (error) => {
        startupError = error;
    });

    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/note_img_test?directConnection=true`, {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }

    await mongoose.connection.db.admin().command({
        replSetInitiate: { _id: "noteImgReplSet", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        const status = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 }).catch(() => null);
        if (status?.members?.[0]?.stateStr === "PRIMARY") break;
        if (attempt >= 40) throw new Error("Replica set did not become primary");
        await delay(250);
    }

    await seedProductSubscriptionFixtures();

    // Permissions
    const permNotesRead = await PermissionModel.create({
        name: "Read Notes",
        displayName: "Read Notes",
        code: "NOTES_READ_GENERAL",
        module: PermissionModule.NOTES,
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permNotesCreate = await PermissionModel.create({
        name: "Create Notes",
        displayName: "Create Notes",
        code: "NOTES_CREATE_GENERAL",
        module: PermissionModule.NOTES,
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });

    ownerRole = await RoleModel.create({
        name: "Workspace Owner",
        displayName: "Workspace Owner",
        code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER,
        type: RoleType.SYSTEM,
        scope: RoleScope.WORKSPACE,
        priority: 100,
        isSystem: true,
        isActive: true,
        permissions: [permNotesRead._id, permNotesCreate._id],
    });

    creatorUser = await UserModel.create({
        email: "creator@example.test",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
    });
    assigneeUser = await UserModel.create({
        email: "assignee@example.test",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
    });

    creatorToken = JwtUtil.generateAccessToken(creatorUser._id.toString(), new Types.ObjectId().toString());
    assigneeToken = JwtUtil.generateAccessToken(assigneeUser._id.toString(), new Types.ObjectId().toString());

    creatorMedia = await MediaModel.create({
        uploadedBy: creatorUser._id,
        mediaType: MediaType.IMAGE,
        originalFileName: "creator.png",
        bucket: "note-img-test",
        mimeType: "image/png",
        size: 1024,
        purpose: MediaPurpose.PROFILE_IMAGE,
        visibility: MediaVisibility.PRIVATE,
        status: MediaStatus.READY,
        storageKey: `user/avatars/${creatorUser._id}/2026/creator.png`,
        resourceType: MediaResourceType.USER,
        resourceId: creatorUser._id,
        isConfirmed: true,
    });

    assigneeMedia = await MediaModel.create({
        uploadedBy: assigneeUser._id,
        mediaType: MediaType.IMAGE,
        originalFileName: "assignee.png",
        bucket: "note-img-test",
        mimeType: "image/png",
        size: 1024,
        purpose: MediaPurpose.PROFILE_IMAGE,
        visibility: MediaVisibility.PUBLIC,
        publicUrl: `https://cdn.example.test/user/avatars/${assigneeUser._id}/2026/assignee.png`,
        status: MediaStatus.READY,
        storageKey: `user/avatars/${assigneeUser._id}/2026/assignee.png`,
        resourceType: MediaResourceType.USER,
        resourceId: assigneeUser._id,
        isConfirmed: true,
    });

    creatorProfile = await UserProfileModel.create({
        userId: creatorUser._id,
        firstName: "Creator",
        lastName: "Owner",
        displayName: "Chief Creator",
        profileType: "PERSONAL",
        profileImage: creatorMedia._id,
    });

    assigneeProfile = await UserProfileModel.create({
        userId: assigneeUser._id,
        firstName: "Assignee",
        lastName: "Member",
        displayName: "Dev Assignee",
        profileType: "PERSONAL",
        profileImage: assigneeMedia._id,
    });

    testWorkspace = await WorkspaceModel.create({
        name: "Note Image Workspace",
        slug: "note-image-ws",
        ownerId: creatorUser._id,
        status: "ACTIVE",
    });

    await WorkspaceMemberModel.create({
        workspaceId: testWorkspace._id,
        userId: creatorUser._id,
        roleId: ownerRole._id,
        status: "ACTIVE",
    });

    testFolder = await WorkspaceFolderModel.create({
        workspaceId: testWorkspace._id,
        name: "Folder 1",
        slug: "folder-1",
        status: "ACTIVE",
        createdBy: creatorUser._id,
        updatedBy: creatorUser._id,
    });

    testColumn = await StickyNoteColumnModel.create({
        workspaceId: testWorkspace._id,
        workspaceFolderId: testFolder._id,
        name: "To do",
        type: StickyNoteColumnType.TODO,
        color: StickyNoteColumnColor.YELLOW,
        position: 0,
        rank: "00100000",
        isSystem: true,
        createdBy: creatorUser._id,
    });

    testNote = await StickyNoteModel.create({
        workspaceId: testWorkspace._id,
        workspaceFolderId: testFolder._id,
        columnId: testColumn._id,
        title: "Test Note with Images",
        content: "Testing profile images on note",
        stickyNoteNumber: 1,
        color: StickyNoteColor.YELLOW,
        priority: StickyNotePriority.MEDIUM,
        shape: StickyNoteShape.SQUARE,
        variant: StickyNoteVariant.PLAIN,
        backgroundPattern: StickyNoteBackgroundPattern.NONE,
        position: 0,
        rank: "00100000",
        status: StickyNoteStatus.ACTIVE,
        createdBy: creatorUser._id,
        updatedBy: creatorUser._id,
    });

    await StickyNoteAssigneeModel.create({
        workspaceId: testWorkspace._id,
        stickyNoteId: testNote._id,
        userId: assigneeUser._id,
        status: StickyNoteAssigneeStatus.ACTIVE,
        assignedBy: creatorUser._id,
        assignedAt: new Date(),
    });

    const app = express();
    app.use(express.json());
    app.use("/stickynotes", stickyNoteRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
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

test("GET /stickynotes/getall provides profileImage and avatarUrl for assignees and creator", async () => {
    const res = await fetch(`${baseUrl}/stickynotes/getall?workspaceId=${testWorkspace._id}`, {
        headers: {
            Authorization: `Bearer ${creatorToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 1);

    const note = body.data[0];
    assert.equal(note.id, testNote._id.toString());

    // Creator checks
    assert.equal(note.creatorEmail, "creator@example.test");
    assert.equal(note.creatorName, "Chief Creator");
    assert.ok(note.creatorAvatarUrl);
    assert.ok(note.creatorAvatarUrl.includes("mock-r2.test"));
    assert.ok(note.creatorProfileImage);
    assert.equal(note.creatorProfileImage.id, creatorMedia._id.toString());
    assert.equal(note.creatorProfileImage.url, note.creatorAvatarUrl);

    assert.ok(note.creator);
    assert.equal(note.creator.id, creatorUser._id.toString());
    assert.equal(note.creator.name, "Chief Creator");
    assert.equal(note.creator.email, "creator@example.test");
    assert.equal(note.creator.avatarUrl, note.creatorAvatarUrl);
    assert.equal(note.creator.profileImage.id, creatorMedia._id.toString());

    // Assignee checks
    assert.ok(Array.isArray(note.assignees));
    assert.equal(note.assignees.length, 1);

    const assignee = note.assignees[0];
    assert.equal(assignee.id, assigneeUser._id.toString());
    assert.equal(assignee.name, "Dev Assignee");
    assert.equal(assignee.email, "assignee@example.test");
    assert.ok(assignee.avatarUrl);
    assert.equal(assignee.avatarUrl, `https://cdn.example.test/user/avatars/${assigneeUser._id}/2026/assignee.png`);
    assert.ok(assignee.profileImage);
    assert.equal(assignee.profileImage.id, assigneeMedia._id.toString());
    assert.equal(assignee.profileImage.url, assignee.avatarUrl);
});

test("POST /stickynotes/getall provides profileImage and avatarUrl for assignees and creator", async () => {
    const res = await fetch(`${baseUrl}/stickynotes/getall`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${creatorToken}`,
        },
        body: JSON.stringify({
            workspaceId: testWorkspace._id.toString(),
        }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);

    const note = body.data[0];
    assert.equal(note.creatorName, "Chief Creator");
    assert.ok(note.creatorProfileImage.url);
    assert.equal(note.assignees[0].name, "Dev Assignee");
    assert.ok(note.assignees[0].profileImage.url);
});

test("GET /stickynotes/get/:id provides profileImage and avatarUrl for assignees and creator", async () => {
    const res = await fetch(`${baseUrl}/stickynotes/get/${testNote._id}`, {
        headers: {
            Authorization: `Bearer ${creatorToken}`,
        },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const note = body.data;
    assert.equal(note.id, testNote._id.toString());
    assert.equal(note.creatorName, "Chief Creator");
    assert.ok(note.creatorProfileImage);
    assert.equal(note.creatorProfileImage.id, creatorMedia._id.toString());
    assert.equal(note.assignees[0].name, "Dev Assignee");
    assert.ok(note.assignees[0].profileImage);
    assert.equal(note.assignees[0].profileImage.id, assigneeMedia._id.toString());
});

test("note lists and details embed only active scoped attachment metadata in stable order", async () => {
    const { StickyNoteAttachmentService } = await import("../src/modules/stickynoteattachment/services/stickyNoteAttachment.service.ts");
    const { StickyNoteAttachmentRepository } = await import("../src/modules/stickynoteattachment/repositories/stickyNoteAttachment.repository.ts");
    const repository = new StickyNoteAttachmentRepository();
    const headers = { Authorization: `Bearer ${creatorToken}`, "Content-Type": "application/json" };
    const empty = await fetch(`${baseUrl}/stickynotes/get/${testNote._id}`, { headers });
    assert.deepEqual((await empty.json()).data.attachments, []);

    const makeAttachment = (overrides = {}) => MediaModel.create({
        uploadedBy: creatorUser._id,
        tenantId: creatorUser._id,
        workspaceId: testWorkspace._id,
        storageKeyVersion: 2,
        bucket: "private-test-bucket",
        storageKey: `attachments/${new Types.ObjectId()}.txt`,
        originalFileName: "notes.txt",
        mimeType: "text/plain",
        size: 40,
        mediaType: MediaType.DOCUMENT,
        purpose: MediaPurpose.ATTACHMENT,
        visibility: MediaVisibility.PRIVATE,
        status: MediaStatus.ACTIVE,
        resourceType: MediaResourceType.NOTE,
        resourceId: testNote._id,
        ...overrides,
    });
    const later = await makeAttachment({ sortOrder: 2 });
    const first = await makeAttachment({ sortOrder: 1, originalFileName: "first.txt" });
    const legacy = await makeAttachment({ sortOrder: 3, tenantId: null, workspaceId: null, storageKeyVersion: 1 });
    await makeAttachment({ status: MediaStatus.PENDING });
    await makeAttachment({ status: MediaStatus.DELETED });
    await makeAttachment({ storageDeletionPending: true });
    await makeAttachment({ tenantId: assigneeUser._id });
    await makeAttachment({ workspaceId: new Types.ObjectId() });
    await makeAttachment({ tenantId: null, workspaceId: null });
    await makeAttachment({ resourceId: new Types.ObjectId() });
    await makeAttachment({ resourceType: MediaResourceType.USER });
    await makeAttachment({ purpose: MediaPurpose.AVATAR });

    const attachmentList = await new StickyNoteAttachmentService().list(String(testNote._id), String(creatorUser._id), {});
    const expected = JSON.parse(JSON.stringify(attachmentList.data));
    assert.deepEqual(expected.map((item) => item.attachmentId), [first, later, legacy].map((item) => String(item._id)));

    const { StickyNoteFavoriteModel } = await import("../src/modules/stickynotesfavorites/models/stickyNoteFavorite.model.ts");
    const { StickyNoteFavoriteService } = await import("../src/modules/stickynotesfavorites/services/stickyNoteFavorite.service.ts");
    await StickyNoteFavoriteModel.create({ stickyNoteId: testNote._id, userId: creatorUser._id });
    const favorites = await new StickyNoteFavoriteService().getStickyNoteFavorites(String(creatorUser._id));
    assert.deepEqual(JSON.parse(JSON.stringify(favorites.data[0].stickyNote.attachments)), expected);

    await StickyNoteModel.updateOne({ _id: testNote._id }, { noteDate: "2000-01-01" });
    const overdueResponse = await fetch(`${baseUrl}/stickynotes/overdue?workspaceId=${testWorkspace._id}`, { headers });
    assert.equal(overdueResponse.status, 200);
    const overdue = await overdueResponse.json();
    assert.deepEqual(overdue.data.notes.find((note) => note.id === String(testNote._id)).attachments, expected);

    for (const [path, options, isList] of [
        [`/getall?workspaceId=${testWorkspace._id}`, {}, true],
        ["/getall", { method: "POST", body: JSON.stringify({ workspaceId: String(testWorkspace._id) }) }, true],
        [`/get/${testNote._id}`, {}, false],
    ]) {
        const response = await fetch(`${baseUrl}/stickynotes${path}`, { ...options, headers });
        assert.equal(response.status, 200);
        const body = await response.json();
        const note = isList ? body.data.find((item) => item.id === String(testNote._id)) : body.data;
        assert.deepEqual(note.attachments, expected);
        for (const item of note.attachments) {
            assert.equal(item.bucket, undefined);
            assert.equal(item.storageKey, undefined);
            assert.equal(item.downloadUrl, undefined);
        }
    }

    assert.equal((await repository.findMap([])).size, 0);
    const unrelatedId = String(new Types.ObjectId());
    const batched = await repository.findMap([String(testNote._id), unrelatedId]);
    assert.equal(batched.get(String(testNote._id)).length, 3);
    assert.equal(batched.has(unrelatedId), false);

    try {
        await StickyNoteModel.updateOne({ _id: testNote._id }, { status: StickyNoteStatus.ARCHIVED });
        assert.equal((await repository.findMap([String(testNote._id)])).get(String(testNote._id)).length, 3);
        await StickyNoteModel.updateOne({ _id: testNote._id }, { status: StickyNoteStatus.TRASHED });
        assert.equal((await repository.findMap([String(testNote._id)])).size, 0);
    } finally {
        await StickyNoteModel.updateOne({ _id: testNote._id }, { status: StickyNoteStatus.ACTIVE });
    }
    assert.equal((await repository.findMap([String(testNote._id)])).get(String(testNote._id)).length, 3);
});
