import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";

import { UserModel } from "../src/modules/user/models/user.model.ts";
import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickyNote.model.ts";
import { MediaModel } from "../src/modules/media/models/media.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { SubscriptionUsageModel } from "../src/modules/subscriptionusage/models/subscriptionusage.model.ts";
import { SubscriptionUsageService } from "../src/modules/subscriptionusage/services/subscriptionusage.service.ts";
import { SubscriptionUsageRepository } from "../src/modules/subscriptionusage/repositories/subscriptionusage.repository.ts";
import {
    BillingScopeType,
    SubscriptionResource,
} from "../src/modules/subscriptionusage/constants/subscriptionusage.enums.js";
import { WorkspaceStatus } from "../src/modules/workspace/constants/workspace.enums.js";
import { WorkspaceFolderStatus } from "../src/modules/workspaceFolders/constants/workspaceFolder.enums.js";
import {
    StickyNoteStatus,
    StickyNotePriority,
    StickyNoteColor,
    StickyNoteShape,
    StickyNoteVariant,
    StickyNoteBackgroundPattern,
} from "../src/modules/stickynotes/constants/stickyNote.enums.js";
import {
    MediaStatus,
    MediaPurpose,
    MediaResourceType,
    MediaType,
    MediaStorageProvider,
} from "../src/modules/media/constants/media.enums.js";
import { WorkspaceMemberStatus } from "../src/modules/workspaceMember/constants/workspaceMember.enums.js";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "usage-test-secret";
process.env.JWT_REFRESH_SECRET = "usage-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: routes } =
    await import("../src/modules/subscriptionusage/routes/subscriptionusage.routes.ts");

const service = new SubscriptionUsageService();
const repository = new SubscriptionUsageRepository();
let mongo, directory, server, url, adminUser, userA, userB, globalRoleId, memberRoleId;

async function createUser(emailPrefix = "user") {
    const user = await UserModel.create({
        email: `${emailPrefix}-${new Types.ObjectId()}@test.com`,
        globalRoleId,
        status: "ACTIVE",
        isDeleted: false,
    });
    return String(user._id);
}

async function createWorkspace(ownerId, status = WorkspaceStatus.ACTIVE, overrides = {}) {
    return WorkspaceModel.create({
        name: `Workspace ${new Types.ObjectId()}`,
        slug: `ws-${new Types.ObjectId()}`,
        ownerId: new Types.ObjectId(ownerId),
        status,
        visibility: "PRIVATE",
        isPersonal: false,
        createdBy: new Types.ObjectId(ownerId),
        updatedBy: new Types.ObjectId(ownerId),
        ...overrides,
    });
}

async function createFolder(workspaceId, status = WorkspaceFolderStatus.ACTIVE, overrides = {}) {
    return WorkspaceFolderModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        name: `Folder ${new Types.ObjectId()}`,
        slug: `fld-${new Types.ObjectId()}`,
        position: 1,
        isDefault: false,
        status,
        ...overrides,
    });
}

async function createNote(workspaceId, status = StickyNoteStatus.ACTIVE, overrides = {}) {
    return StickyNoteModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        columnId: new Types.ObjectId(),
        stickyNoteNumber: Math.floor(Math.random() * 900000) + 1,
        content: "Test note content",
        title: "Test note",
        color: StickyNoteColor.YELLOW,
        priority: StickyNotePriority.MEDIUM,
        shape: StickyNoteShape.SQUARE,
        variant: StickyNoteVariant.PLAIN,
        backgroundPattern: StickyNoteBackgroundPattern.NONE,
        position: 1,
        status,
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId(),
        ...overrides,
    });
}

async function createMedia(
    uploadedBy,
    size,
    status = MediaStatus.ACTIVE,
    resourceType = null,
    resourceId = null,
    overrides = {},
) {
    const mediaId = new Types.ObjectId();
    return MediaModel.create({
        _id: mediaId,
        uploadedBy: new Types.ObjectId(uploadedBy),
        storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
        bucket: "test-bucket",
        storageKey: `attachments/${mediaId}-${Math.random()}.png`,
        originalFileName: "image.png",
        mimeType: "image/png",
        size,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
        status,
        resourceType,
        resourceId: resourceId ? new Types.ObjectId(resourceId) : null,
        storageDeletionPending: false,
        ...overrides,
    });
}

async function request(path, { body, user = userA, method = body === undefined ? "GET" : "POST" } = {}) {
    const response = await fetch(url + path, {
        method,
        headers: {
            ...(user ? { Authorization: "Bearer " + user } : {}),
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text.startsWith("{") ? JSON.parse(text) : text };
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    directory = await mkdtemp(join(tmpdir(), "usage-test-"));
    mongo = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            directory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            join(directory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongo.on("error", (error) => {
        startupError = error;
    });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect("mongodb://127.0.0.1:" + port + "/usage_test", {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }

    await Promise.all([
        SubscriptionUsageModel.createIndexes(),
        WorkspaceModel.createIndexes(),
        WorkspaceFolderModel.createIndexes(),
        StickyNoteModel.createIndexes(),
        MediaModel.createIndexes(),
        WorkspaceMemberModel.createIndexes(),
    ]);

    const permissions = await PermissionModel.create([
        {
            name: "usage_read",
            displayName: "Read Usage",
            code: "SUBSCRIPTION_USAGE_READ",
            module: "SUBSCRIPTION_USAGE",
            action: "READ",
            access: "ANY",
            isActive: true,
        },
        {
            name: "usage_manage",
            displayName: "Manage Usage",
            code: "SUBSCRIPTION_USAGE_MANAGE",
            module: "SUBSCRIPTION_USAGE",
            action: "MANAGE",
            access: "ANY",
            isActive: true,
        },
        {
            name: "workspace_read",
            displayName: "Read Workspace",
            code: "WORKSPACE_READ",
            module: "WORKSPACE",
            action: "READ",
            access: "GENERAL",
            isActive: true,
        },
    ]);

    const adminRole = await RoleModel.create({
        name: "usage_admin",
        displayName: "Usage Admin",
        code: "USAGE_ADMIN",
        scope: "GLOBAL",
        workspaceId: null,
        isActive: true,
        permissions: permissions.map((p) => p._id),
    });

    const standardRole = await RoleModel.create({
        name: "standard_user",
        displayName: "Standard User",
        code: "STANDARD_USER",
        scope: "GLOBAL",
        workspaceId: null,
        isActive: true,
        permissions: [],
    });

    const wsMemberRole = await RoleModel.create({
        name: "workspace_member",
        displayName: "Workspace Member",
        code: "WORKSPACE_MEMBER",
        scope: "WORKSPACE",
        workspaceId: null,
        isSystem: true,
        isActive: true,
        permissions: [permissions[2]._id],
    });

    globalRoleId = standardRole._id;
    memberRoleId = wsMemberRole._id;

    adminUser = await createUser("admin");
    await UserModel.updateOne({ _id: adminUser }, { globalRoleId: adminRole._id });
    userA = await createUser("userA");
    userB = await createUser("userB");

    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));

    const app = express();
    app.use(express.json());
    app.use("/subscriptionusage", routes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = "http://127.0.0.1:" + server.address().port + "/subscriptionusage";
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
    await mongoose.disconnect();
    if (mongo?.pid && mongo.exitCode === null) {
        const exited = once(mongo, "exit");
        mongo.kill();
        await exited;
    }
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("usage-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("1. User with no workspaces reports zero resource consumption", async () => {
    const emptyUser = await createUser("empty");
    const summary = await service.getMyUsage(emptyUser);

    assert.equal(summary.scopeType, BillingScopeType.USER);
    assert.equal(summary.scopeId, emptyUser);
    assert.equal(summary.workspacesUsed, 0);
    assert.equal(summary.activeStickyNotesUsed, 0);
    assert.equal(summary.storageBytesUsed, 0);
    assert.equal(summary.usersUsed, 1);
});

test("2. User with multiple workspaces aggregates active workspaces correctly", async () => {
    const u = await createUser("multi-ws");
    await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createWorkspace(u, WorkspaceStatus.ACTIVE);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.workspacesUsed, 2);
});

test("3. Shared workspace membership does not duplicate or leak workspace usage", async () => {
    const owner = await createUser("owner-shared");
    const member = await createUser("member-shared");
    const ws = await createWorkspace(owner, WorkspaceStatus.ACTIVE);

    await WorkspaceMemberModel.create({
        workspaceId: ws._id,
        userId: new Types.ObjectId(member),
        roleId: memberRoleId,
        status: WorkspaceMemberStatus.ACTIVE,
    });

    const ownerSummary = await service.getMyUsage(owner);
    const memberSummary = await service.getMyUsage(member);

    assert.equal(ownerSummary.workspacesUsed, 1);
    assert.equal(memberSummary.workspacesUsed, 0);
});

test("4. Folder count per workspace measures active folders accurately", async () => {
    const u = await createUser("folder-test");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createFolder(ws._id, WorkspaceFolderStatus.ACTIVE);
    await createFolder(ws._id, WorkspaceFolderStatus.ACTIVE);

    const summary = await service.getMyUsage(u, { includeFolders: true });
    assert.equal(summary.workspacesUsed, 1);
    assert.ok(Array.isArray(summary.workspaceFolders));
    assert.equal(summary.workspaceFolders.length, 1);
    assert.equal(summary.workspaceFolders[0].foldersUsed, 2);
});

test("5. Archived workspace is counted in workspacesUsed", async () => {
    const u = await createUser("archived-ws");
    await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createWorkspace(u, WorkspaceStatus.ARCHIVED);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.workspacesUsed, 2);
});

test("6. Trashed workspace is excluded from workspacesUsed", async () => {
    const u = await createUser("trashed-ws");
    await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createWorkspace(u, WorkspaceStatus.TRASHED);
    await createWorkspace(u, WorkspaceStatus.DELETED);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.workspacesUsed, 1);
});

test("7. Active sticky notes across all owned workspaces are counted", async () => {
    const u = await createUser("active-notes");
    const ws1 = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const ws2 = await createWorkspace(u, WorkspaceStatus.ACTIVE);

    await createNote(ws1._id, StickyNoteStatus.ACTIVE);
    await createNote(ws1._id, StickyNoteStatus.ACTIVE);
    await createNote(ws2._id, StickyNoteStatus.ACTIVE);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.activeStickyNotesUsed, 3);
});

test("8. Archived and trashed sticky notes are excluded from active note count", async () => {
    const u = await createUser("note-status");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);

    await createNote(ws._id, StickyNoteStatus.ACTIVE);
    await createNote(ws._id, StickyNoteStatus.ARCHIVED);
    await createNote(ws._id, StickyNoteStatus.TRASHED);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.activeStickyNotesUsed, 1);
});

test("9. Attachment bytes calculation sums completed file sizes", async () => {
    const u = await createUser("attach-bytes");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.ACTIVE);

    await createMedia(u, 1024, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    await createMedia(u, 2048, MediaStatus.ACTIVE, MediaResourceType.WORKSPACE, ws._id);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, 3072);
});

test("10. Attachments on trashed notes remain retained and counted", async () => {
    const u = await createUser("retained-trash");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.TRASHED);

    await createMedia(u, 5000, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, 5000);
});

test("11. Multiple attachments with distinct metadata are summed accurately", async () => {
    const u = await createUser("multi-attach");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.ACTIVE);

    await createMedia(u, 100, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    await createMedia(u, 200, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    await createMedia(u, 300, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, 600);
});

test("12. Failed upload is excluded from storage accounting", async () => {
    const u = await createUser("failed-upload");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.ACTIVE);

    await createMedia(u, 1000, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    await createMedia(u, 9999, MediaStatus.FAILED, MediaResourceType.NOTE, note._id);
    await createMedia(u, 8888, MediaStatus.PENDING, MediaResourceType.NOTE, note._id);

    const summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, 1000);
});

test("13. Deleted file is released from storage quota", async () => {
    const u = await createUser("deleted-file");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.ACTIVE);

    const m = await createMedia(u, 4000, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    let summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, 4000);

    await MediaModel.updateOne(
        { _id: m._id },
        { status: MediaStatus.DELETED, storageDeletionPending: true, deletedAt: new Date() },
    );

    summary = await service.recalculateUsage({ type: BillingScopeType.USER, id: u });
    assert.equal(summary.storageBytesUsed, 0);
});

test("14. Usage reconciliation recalculates from source and produces accurate reports", async () => {
    const u = await createUser("recon-test");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createNote(ws._id, StickyNoteStatus.ACTIVE);

    const report = await service.reconcileUsage({ type: BillingScopeType.USER, id: u });
    assert.equal(report.scopeId, u);
    assert.equal(report.status, "REPAIRED");
    assert.equal(report.actual.workspacesUsed, 1);
    assert.equal(report.actual.activeStickyNotesUsed, 1);
    assert.equal(report.repaired, true);
});

test("15. Reconciliation idempotency: repeated reconciliation returns MATCHED with zero drift", async () => {
    const u = await createUser("recon-idempotent");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await createNote(ws._id, StickyNoteStatus.ACTIVE);

    const first = await service.reconcileUsage({ type: BillingScopeType.USER, id: u });
    assert.equal(first.status, "REPAIRED");

    const second = await service.reconcileUsage({ type: BillingScopeType.USER, id: u });
    assert.equal(second.status, "MATCHED");
    assert.equal(second.discrepancy.workspacesDiff, 0);
    assert.equal(second.discrepancy.activeStickyNotesDiff, 0);
    assert.equal(second.repaired, false);
});

test("16. Counter drift detection detects discrepancies when cached counters diverge", async () => {
    const u = await createUser("drift-test");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    await service.recalculateUsage({ type: BillingScopeType.USER, id: u });

    // Artificially corrupt cached document to simulate drift
    await SubscriptionUsageModel.updateOne({ scopeId: new Types.ObjectId(u) }, { workspacesUsed: 99 });

    const report = await service.reconcileUsage({ type: BillingScopeType.USER, id: u });
    assert.equal(report.status, "REPAIRED");
    assert.equal(report.cached.workspacesUsed, 99);
    assert.equal(report.actual.workspacesUsed, 1);
    assert.equal(report.discrepancy.workspacesDiff, -98);
});

test("17. Concurrent updates with optimistic revision detect conflicts safely", async () => {
    const u = await createUser("concurrency-test");
    const { usage } = await repository.upsertUsage(BillingScopeType.USER, u, {
        workspacesUsed: 1,
        activeStickyNotesUsed: 1,
        storageBytesUsed: 100,
        usersUsed: 1,
        lastCalculatedAt: new Date(),
    });

    const currentRev = usage.revision;
    // Successful update with correct expected revision
    const success = await repository.upsertUsage(
        BillingScopeType.USER,
        u,
        {
            workspacesUsed: 2,
            activeStickyNotesUsed: 2,
            storageBytesUsed: 200,
            usersUsed: 1,
            lastCalculatedAt: new Date(),
        },
        currentRev,
    );
    assert.equal(success.conflict, false);

    // Stale update with old revision detects conflict
    const stale = await repository.upsertUsage(
        BillingScopeType.USER,
        u,
        {
            workspacesUsed: 3,
            activeStickyNotesUsed: 3,
            storageBytesUsed: 300,
            usersUsed: 1,
            lastCalculatedAt: new Date(),
        },
        currentRev,
    );
    assert.equal(stale.conflict, true);
});

test("18. Unauthorized access is rejected with 401", async () => {
    const res = await request("/me", { user: null });
    assert.equal(res.status, 401);
});

test("19. Cross-user isolation: user cannot inspect workspace usage without authorization", async () => {
    const owner = await createUser("owner-iso");
    const stranger = await createUser("stranger-iso");
    const ws = await createWorkspace(owner, WorkspaceStatus.ACTIVE);

    const res = await request(`/workspace/${ws._id}`, { user: stranger });
    assert.equal(res.status, 403);
});

test("20. Administrative pagination, sorting and filtering on getall endpoint", async () => {
    const res = await request("/admin/getall", {
        user: adminUser,
        body: { page: 1, limit: 5, sortBy: "workspacesUsed", sortOrder: "desc" },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 5);
});

test("21. Large usage values validate as safe integers", async () => {
    const u = await createUser("large-usage");
    const ws = await createWorkspace(u, WorkspaceStatus.ACTIVE);
    const note = await createNote(ws._id, StickyNoteStatus.ACTIVE);
    const largeSize = 50 * 1024 * 1024 * 1024; // 50 GB

    await createMedia(u, largeSize, MediaStatus.ACTIVE, MediaResourceType.NOTE, note._id);
    const summary = await service.getMyUsage(u);
    assert.equal(summary.storageBytesUsed, largeSize);
    assert.ok(Number.isSafeInteger(summary.storageBytesUsed));
});

test("22. Unique compound index on scopeType and scopeId prevents duplicates", async () => {
    const u = new Types.ObjectId();
    await SubscriptionUsageModel.create({
        scopeType: BillingScopeType.USER,
        scopeId: u,
        workspacesUsed: 1,
        activeStickyNotesUsed: 1,
        storageBytesUsed: 100,
        usersUsed: 1,
        lastCalculatedAt: new Date(),
        revision: 0,
    });

    await assert.rejects(
        () =>
            SubscriptionUsageModel.create({
                scopeType: BillingScopeType.USER,
                scopeId: u,
                workspacesUsed: 2,
                activeStickyNotesUsed: 2,
                storageBytesUsed: 200,
                usersUsed: 1,
                lastCalculatedAt: new Date(),
                revision: 0,
            }),
        /E11000|duplicate key/,
    );
});

test("23. Empty and missing options handle gracefully with standard response", async () => {
    const u = await createUser("graceful-test");
    const res = await request("/me", { user: u });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.scopeType, "USER");
    assert.equal(res.body.data.workspacesUsed, 0);
});

test("24. Workspace member with read permission can inspect workspace-scoped usage", async () => {
    const owner = await createUser("owner-perm");
    const member = await createUser("member-perm");
    const ws = await createWorkspace(owner, WorkspaceStatus.ACTIVE);

    await WorkspaceMemberModel.create({
        workspaceId: ws._id,
        userId: new Types.ObjectId(member),
        roleId: memberRoleId,
        status: WorkspaceMemberStatus.ACTIVE,
    });
    await createFolder(ws._id, WorkspaceFolderStatus.ACTIVE);
    await createNote(ws._id, StickyNoteStatus.ACTIVE);

    const res = await request(`/workspace/${ws._id}`, { user: member });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.workspaceId, String(ws._id));
    assert.equal(res.body.data.foldersUsed, 1);
    assert.equal(res.body.data.activeStickyNotesUsed, 1);
    assert.equal(res.body.data.isOwner, false);
});
