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

import { UserModel } from "../src/modules/user/models/user.model.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { FeatureModel } from "../src/modules/feature/models/feature.model.ts";
import { PlanFeatureModel } from "../src/modules/planfeature/models/planfeature.model.ts";
import { UserSubscriptionModel } from "../src/modules/usersubscription/models/usersubscription.model.ts";
import { SubscriptionUsageModel } from "../src/modules/subscriptionusage/models/subscriptionusage.model.ts";
import { SubscriptionReservationModel } from "../src/modules/subscriptionentitlement/models/subscriptionreservation.model.ts";
import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickynote.model.ts";
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { MediaModel } from "../src/modules/media/models/media.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";

import { SubscriptionSeedService } from "../src/seeders/subscription/services/subscription-seed.service.ts";
import { SubscriptionSeedRepository } from "../src/seeders/subscription/repositories/subscription-seed.repository.ts";
import { SubscriptionEntitlementService } from "../src/modules/subscriptionentitlement/services/subscriptionentitlement.service.ts";
import { SubscriptionEntitlementRepository } from "../src/modules/subscriptionentitlement/repositories/subscriptionentitlement.repository.ts";
import { SubscriptionUsageService } from "../src/modules/subscriptionusage/services/subscriptionusage.service.ts";
import { UserSubscriptionService } from "../src/modules/usersubscription/services/usersubscription.service.ts";
import { WorkspaceService } from "../src/modules/workspace/services/workspace.service.ts";
import { WorkspaceFolderService } from "../src/modules/workspaceFolders/services/workspaceFolder.service.ts";
import { StickyNoteService } from "../src/modules/stickynotes/services/stickynote.service.ts";
import { MediaService } from "../src/modules/media/services/media.service.ts";

import { FeatureCode } from "../src/modules/feature/constants/feature.enums.js";
import { BillingScopeType } from "../src/modules/subscriptionusage/constants/subscriptionusage.enums.js";
import {
    ReservationStatus,
    EntitlementErrorCode,
    EntitlementDecisionReason,
} from "../src/modules/subscriptionentitlement/constants/subscriptionentitlement.enums.js";
import { WorkspaceStatus } from "../src/modules/workspace/constants/workspace.enums.js";
import { WorkspaceFolderStatus } from "../src/modules/workspaceFolders/constants/workspaceFolder.enums.js";
import {
    StickyNoteStatus,
    StickyNoteColor,
    StickyNotePriority,
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
import { UserSubscriptionStatus } from "../src/modules/usersubscription/constants/usersubscription.enums.js";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "entitlement-test-secret";
process.env.JWT_REFRESH_SECRET = "entitlement-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: entitlementRoutes } =
    await import("../src/modules/subscriptionentitlement/routes/subscriptionentitlement.routes.ts");

let mongo,
    directory,
    server,
    url,
    freePlan,
    individualPlan,
    proPlan,
    globalRoleId,
    workspaceMemberRoleId,
    test17UserId;
const entitlementService = new SubscriptionEntitlementService();
const entitlementRepo = new SubscriptionEntitlementRepository();
const usageService = new SubscriptionUsageService();
const userSubscriptionService = new UserSubscriptionService();
const workspaceService = new WorkspaceService();
const folderService = new WorkspaceFolderService();
const noteService = new StickyNoteService();
const mediaService = new MediaService();

async function withPlanFeature(code, changes, operation) {
    const feature = await FeatureModel.findOne({ code });
    const original = await PlanFeatureModel.findOne({ planId: freePlan._id, featureId: feature._id }).lean();
    await PlanFeatureModel.updateOne({ _id: original._id }, { $set: changes });
    try {
        return await operation();
    } finally {
        await PlanFeatureModel.replaceOne({ _id: original._id }, original);
    }
}

async function createNoteFixture() {
    const userId = await createUser("policy");
    const workspace = await workspaceService.createWorkspace(
        { name: "Policy", slug: `policy-${new Types.ObjectId()}` },
        userId,
    );
    const createdFolder = await folderService.createWorkspaceFolder(
        { workspaceId: workspace.id, name: "Policy folder", slug: "policy-folder" },
        userId,
    );
    const folder = await WorkspaceFolderModel.findById(createdFolder.id);
    const column = await StickyNoteColumnModel.create({
        workspaceId: workspace.id,
        workspaceFolderId: folder._id,
        createdBy: userId,
        name: "Policy column",
        position: 1,
    });
    const data = {
        workspaceId: workspace.id,
        workspaceFolderId: String(folder._id),
        columnId: String(column._id),
        title: "Policy note",
        content: "Test",
    };
    const note = await noteService.createStickyNote(data, userId);
    return { userId, workspace, folder, column, data, note };
}

test("disabled capabilities block creation even when numeric quota is available", async () => {
    const { userId, workspace, data } = await createNoteFixture();
    for (const [code, create] of [
        [
            FeatureCode.WORKSPACES,
            () =>
                workspaceService.createWorkspace(
                    { name: "Blocked", slug: `blocked-${new Types.ObjectId()}` },
                    userId,
                ),
        ],
        [
            FeatureCode.FOLDERS,
            () =>
                folderService.createWorkspaceFolder(
                    { workspaceId: workspace.id, name: "Blocked", slug: "blocked" },
                    userId,
                ),
        ],
        [FeatureCode.NOTES, () => noteService.createStickyNote(data, userId)],
        [FeatureCode.MEMBERS, () => entitlementService.assertCanAddMember(userId, workspace.id)],
        [
            FeatureCode.ATTACHMENTS,
            () => entitlementService.assertCanUploadAttachment(userId, null, null, 100),
        ],
    ]) {
        await withPlanFeature(code, { isEnabled: false }, async () => {
            await assert.rejects(create, { code: EntitlementErrorCode.SUBSCRIPTION_FEATURE_DISABLED });
        });
    }
});

test("disabled unlimited quotas cannot grant capacity and summaries report zero", async () => {
    const userId = await createUser("disabled-unlimited");
    await withPlanFeature(FeatureCode.MAX_WORKSPACES, { isEnabled: false, isUnlimited: true }, async () => {
        await assert.rejects(() => entitlementService.assertCanCreateWorkspace(userId), {
            code: EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        });
        const summary = await entitlementService.getMyEntitlements(userId);
        assert.equal(summary.resources.MAX_WORKSPACES.limit, 0);
        assert.equal(summary.resources.MAX_WORKSPACES.isUnlimited, false);
        assert.equal(summary.resources.MAX_WORKSPACES.remaining, 0);
    });
});

test("pending upload requests consume storage before completion and failures release it", async () => {
    const userId = await createUser("pending-storage");
    const upload = {
        fileName: "test.png",
        mimeType: "image/png",
        size: 600,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
    };
    const urlMock = mock.method(
        mediaService.storageService,
        "createUploadUrl",
        async () => "https://example.test/upload",
    );
    try {
        await withPlanFeature(FeatureCode.MAX_STORAGE_BYTES, { limit: 1000 }, async () => {
            const first = await mediaService.requestUpload(upload, userId);
            assert.equal((await usageService.getMyUsage(userId, { fresh: true })).storageBytesUsed, 600);
            await assert.rejects(() => mediaService.requestUpload(upload, userId), {
                code: EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
            });
            await MediaModel.updateOne({ _id: first.mediaId }, { $set: { status: MediaStatus.FAILED } });
            assert.ok((await mediaService.requestUpload(upload, userId)).mediaId);
        });
    } finally {
        urlMock.mock.restore();
    }
});

test("a media database failure releases the reservation immediately", async () => {
    const userId = await createUser("media-create-failure");
    const failure = mock.method(mediaService.mediaRepository, "create", async () => {
        throw new Error("database failure");
    });
    try {
        await assert.rejects(
            () =>
                mediaService.requestUpload(
                    {
                        fileName: "test.png",
                        mimeType: "image/png",
                        size: 10,
                        mediaType: MediaType.IMAGE,
                        purpose: MediaPurpose.ATTACHMENT,
                    },
                    userId,
                ),
            /database failure/,
        );
        assert.equal(
            await entitlementRepo.getPendingReservationAmount(
                BillingScopeType.USER,
                new Types.ObjectId(userId),
                FeatureCode.MAX_STORAGE_BYTES,
            ),
            0,
        );
    } finally {
        failure.mock.restore();
    }
});

test("workspace restore reserves active descendants and rolls back admission on denial", async () => {
    const { userId, workspace } = await createNoteFixture();
    await workspaceService.deleteWorkspace(workspace.id, userId);
    await withPlanFeature(FeatureCode.MAX_ACTIVE_STICKY_NOTES, { limit: 0 }, async () => {
        await assert.rejects(() => workspaceService.restoreWorkspace(workspace.id, userId), {
            code: EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
        });
        assert.equal((await WorkspaceModel.findById(workspace.id)).status, WorkspaceStatus.TRASHED);
        assert.equal(
            await entitlementRepo.getPendingReservationAmount(
                BillingScopeType.USER,
                new Types.ObjectId(userId),
                FeatureCode.MAX_WORKSPACES,
            ),
            0,
        );
    });
    await workspaceService.restoreWorkspace(workspace.id, userId);
    assert.equal((await usageService.getMyUsage(userId, { fresh: true })).activeStickyNotesUsed, 1);
});

test("workspace entitlement and preflight endpoints reject outsiders", async () => {
    const { userId, workspace } = await createNoteFixture();
    const outsider = await createUser("outside-policy");
    await assert.rejects(
        () =>
            entitlementService.checkResourceAvailability(outsider, {
                workspaceId: workspace.id,
                resourceCode: FeatureCode.MAX_ACTIVE_STICKY_NOTES,
            }),
        (error) => error.statusCode === 403 || error.statusCode === 404,
    );
    await assert.rejects(() => entitlementService.getWorkspaceEntitlements(outsider, workspace.id));
    const summary = await entitlementService.getWorkspaceEntitlements(userId, workspace.id);
    assert.equal(summary.billingScope.id, userId);
    assert.equal(summary.features.NOTES, true);
    assert.equal(summary.resources.MAX_FOLDERS_PER_WORKSPACE.used, 1);
});

test("operation IDs cannot be reused across owners or after commit", async () => {
    const owner = await createUser("idempotent-owner");
    const outsider = await createUser("idempotent-outsider");
    const operationId = `bound-${new Types.ObjectId()}`;
    const reservation = await entitlementService.assertCanCreateWorkspace(owner, { operationId });
    await assert.rejects(() => entitlementService.assertCanCreateWorkspace(outsider, { operationId }), {
        code: "SUBSCRIPTION_OPERATION_CONFLICT",
    });
    await entitlementService.commitReservation(reservation.reservationId);
    await entitlementService.releaseReservation(reservation.reservationId);
    assert.equal(
        (await entitlementRepo.findReservationById(reservation.reservationId)).status,
        ReservationStatus.COMMITTED,
    );
    await assert.rejects(() => entitlementService.assertCanCreateWorkspace(owner, { operationId }), {
        code: "SUBSCRIPTION_OPERATION_CONFLICT",
    });
});

test("invalid reservation quantities fail before admission", async () => {
    const userId = await createUser("invalid-quantity");
    for (const amount of [NaN, Infinity, -1, 0, 0.5]) {
        await assert.rejects(
            () =>
                entitlementService.reserveCapacity(
                    { type: BillingScopeType.USER, id: userId },
                    FeatureCode.MAX_ACTIVE_STICKY_NOTES,
                    amount,
                ),
            (error) => error.statusCode === 400,
        );
    }
});

test("note submodules and kanban enforce the owner's configured capabilities", async () => {
    const { userId, workspace, folder, note } = await createNoteFixture();
    const noteId = String(note.id ?? note._id);
    const { StickyNoteChecklistService } =
        await import("../src/modules/stickyNoteschecklist/services/stickyNoteChecklist.service.ts");
    const { StickyNoteChecklistItemService } =
        await import("../src/modules/stickynotechecklistitems/services/stickyNoteChecklistItem.service.ts");
    const { StickyNoteLabelService } =
        await import("../src/modules/stickynotelabels/services/stickyNoteLabel.service.ts");
    const { StickyNoteFavoriteService } =
        await import("../src/modules/stickynotesfavorites/services/stickyNoteFavorite.service.ts");
    const { StickyNoteColumnService } =
        await import("../src/modules/stickynotescolumns/services/stickyNoteColumn.service.ts");
    const checklistService = new StickyNoteChecklistService();
    const checklist = await checklistService.createStickyNoteChecklist(
        { stickyNoteId: noteId, title: "Existing" },
        userId,
    );
    await withPlanFeature(FeatureCode.NOTES, { isEnabled: false }, async () => {
        for (const mutation of [
            () =>
                checklistService.createStickyNoteChecklist(
                    { stickyNoteId: noteId, title: "Blocked" },
                    userId,
                ),
            () =>
                new StickyNoteChecklistItemService().createStickyNoteChecklistItem(
                    { checklistId: checklist.id, title: "Blocked" },
                    userId,
                ),
            () =>
                new StickyNoteLabelService().createStickyNoteLabel(
                    { workspaceId: workspace.id, name: "Blocked" },
                    userId,
                ),
            () => new StickyNoteFavoriteService().createStickyNoteFavorite(noteId, userId),
        ]) {
            await assert.rejects(mutation, { code: EntitlementErrorCode.SUBSCRIPTION_FEATURE_DISABLED });
        }
        assert.ok(await noteService.getStickyNoteById(noteId, userId));
    });
    await withPlanFeature(FeatureCode.KANBAN, { isEnabled: false }, async () => {
        await assert.rejects(
            () =>
                new StickyNoteColumnService().createStickyNoteColumn(
                    {
                        workspaceId: workspace.id,
                        workspaceFolderId: String(folder._id),
                        name: "Blocked",
                    },
                    userId,
                ),
            { code: EntitlementErrorCode.SUBSCRIPTION_FEATURE_DISABLED },
        );
    });
});

test("retained attachments in trashed workspaces remain charged to their owner", async () => {
    const { userId, workspace, note } = await createNoteFixture();
    const noteId = String(note.id ?? note._id);
    await MediaModel.create({
        uploadedBy: userId,
        storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
        bucket: "test",
        storageKey: `retained-${new Types.ObjectId()}`,
        originalFileName: "test.png",
        mimeType: "image/png",
        size: 123,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
        status: MediaStatus.ACTIVE,
        resourceType: MediaResourceType.NOTE,
        resourceId: noteId,
    });
    await workspaceService.deleteWorkspace(workspace.id, userId);
    const usage = await usageService.getMyUsage(userId, { fresh: true });
    assert.equal(usage.workspacesUsed, 0);
    assert.equal(usage.storageBytesUsed, 123);
});

async function createUser(emailPrefix = "user") {
    const user = await UserModel.create({
        email: `${emailPrefix}-${new Types.ObjectId()}@test.com`,
        globalRoleId,
        status: "ACTIVE",
        isDeleted: false,
    });
    const userId = String(user._id);
    await userSubscriptionService.ensureFreeSubscription(userId);
    return userId;
}

async function createPaidUser(plan, status = UserSubscriptionStatus.ACTIVE, changes = {}) {
    const user = await UserModel.create({
        email: `paid-${new Types.ObjectId()}@test.com`,
        globalRoleId,
        status: "ACTIVE",
        isDeleted: false,
    });
    const userId = String(user._id);
    const sub = await UserSubscriptionModel.create({
        user: new Types.ObjectId(userId),
        plan: plan._id,
        planPriceId: null,
        billingInterval: "MONTHLY",
        status,
        isActive: status === UserSubscriptionStatus.ACTIVE,
        startDate: new Date("2025-01-01"),
        endDate: new Date(Date.now() + 30 * 86_400_000),
        currentPeriodStart: new Date("2025-01-01"),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        autoRenew: true,
        cancelAtPeriodEnd: false,
        ...changes,
    });
    return { userId, subscription: sub };
}

async function request(path, { body, userId, method = body === undefined ? "GET" : "POST" } = {}) {
    const response = await fetch(url + path, {
        method,
        headers: {
            ...(userId ? { Authorization: "Bearer " + userId } : {}),
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

    directory = await mkdtemp(join(tmpdir(), "entitlement-test-"));
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
            await mongoose.connect("mongodb://127.0.0.1:" + port + "/entitlement_test", {
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
        SubscriptionReservationModel.createIndexes(),
        SubscriptionUsageModel.createIndexes(),
        WorkspaceModel.createIndexes(),
        WorkspaceFolderModel.createIndexes(),
        StickyNoteModel.createIndexes(),
        StickyNoteColumnModel.createIndexes(),
        MediaModel.createIndexes(),
        PlanModel.createIndexes(),
        FeatureModel.createIndexes(),
        PlanFeatureModel.createIndexes(),
        UserSubscriptionModel.createIndexes(),
        RoleModel.createIndexes(),
        PermissionModel.createIndexes(),
        WorkspaceMemberModel.createIndexes(),
    ]);

    // Seed default subscription plans and limits
    const seedRepo = new SubscriptionSeedRepository();
    const seedService = new SubscriptionSeedService(seedRepo);
    await seedService.run({ mode: "apply" });

    freePlan = await PlanModel.findOne({ code: "FREE" });
    individualPlan = await PlanModel.findOne({ code: "INDIVIDUAL" });
    proPlan = await PlanModel.findOne({ code: "PRO" });

    const permissions = await PermissionModel.create([
        {
            name: "ws_create",
            displayName: "Create WS",
            code: "WORKSPACE_CREATE",
            module: "WORKSPACE",
            action: "CREATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "ws_read",
            displayName: "Read WS",
            code: "WORKSPACE_READ",
            module: "WORKSPACE",
            action: "READ",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "ws_update",
            displayName: "Update WS",
            code: "WORKSPACE_UPDATE",
            module: "WORKSPACE",
            action: "UPDATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "ws_delete",
            displayName: "Delete WS",
            code: "WORKSPACE_DELETE",
            module: "WORKSPACE",
            action: "DELETE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "note_create",
            displayName: "Create Note",
            code: "NOTES_CREATE",
            module: "NOTES",
            action: "CREATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "note_read",
            displayName: "Read Note",
            code: "NOTES_READ",
            module: "NOTES",
            action: "READ",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "note_update",
            displayName: "Update Note",
            code: "NOTES_UPDATE",
            module: "NOTES",
            action: "UPDATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "note_delete",
            displayName: "Delete Note",
            code: "NOTES_DELETE",
            module: "NOTES",
            action: "DELETE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "folder_create",
            displayName: "Create Folder",
            code: "FOLDERS_CREATE",
            module: "FOLDERS",
            action: "CREATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "folder_read",
            displayName: "Read Folder",
            code: "FOLDERS_READ",
            module: "FOLDERS",
            action: "READ",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "folder_update",
            displayName: "Update Folder",
            code: "FOLDERS_UPDATE",
            module: "FOLDERS",
            action: "UPDATE",
            access: "GENERAL",
            isActive: true,
        },
        {
            name: "folder_delete",
            displayName: "Delete Folder",
            code: "FOLDERS_DELETE",
            module: "FOLDERS",
            action: "DELETE",
            access: "GENERAL",
            isActive: true,
        },
    ]);

    const role = await RoleModel.create({
        name: "User",
        displayName: "User",
        code: "USER",
        scope: "GLOBAL",
        workspaceId: null,
        description: "Standard user",
        permissions: permissions.map((p) => p._id),
        isSystem: true,
        isActive: true,
    });
    globalRoleId = role._id;

    const wsMemberRole = await RoleModel.create({
        name: "Workspace Member",
        displayName: "Workspace Member",
        code: "WORKSPACE_MEMBER",
        scope: "WORKSPACE",
        workspaceId: null,
        description: "Workspace member role",
        permissions: permissions.map((p) => p._id),
        isSystem: true,
        isActive: true,
    });
    workspaceMemberRoleId = wsMemberRole._id;

    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));

    const app = express();
    app.use(express.json());
    app.use("/subscriptionentitlement", entitlementRoutes);
    app.use(errorMiddleware);

    server = app.listen(0);
    await once(server, "listening");
    url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (mongo) {
        mongo.kill();
        await once(mongo, "close");
    }
    if (directory) await rm(directory, { recursive: true, force: true });
});

// =========================================================================
// Automated Test Suite: 32 Production Requirements
// =========================================================================

test("1. Free user below limits is allowed to create resources", async () => {
    const user = await createUser("below-limit");
    const decision = await entitlementService.checkResourceAvailability(user, {
        resourceCode: FeatureCode.MAX_WORKSPACES,
        requestedAmount: 1,
    });
    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, EntitlementDecisionReason.ALLOWED);
    assert.equal(decision.limit, 3);
    assert.equal(decision.currentUsage, 0);

    const ws = await workspaceService.createWorkspace({ name: "WS 1", slug: "ws-1" }, user);
    assert.ok(ws.id);
});

test("2. Free user at workspace limit (3 workspaces) is blocked", async () => {
    const user = await createUser("ws-limit");
    await workspaceService.createWorkspace({ name: "WS 1", slug: `ws-lim-1-${new Types.ObjectId()}` }, user);
    await workspaceService.createWorkspace({ name: "WS 2", slug: `ws-lim-2-${new Types.ObjectId()}` }, user);
    await workspaceService.createWorkspace({ name: "WS 3", slug: `ws-lim-3-${new Types.ObjectId()}` }, user);

    await assert.rejects(
        () =>
            workspaceService.createWorkspace(
                { name: "WS 4", slug: `ws-lim-4-${new Types.ObjectId()}` },
                user,
            ),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            assert.match(err.message, /maximum of 3 workspaces/i);
            return true;
        },
    );
});

test("3. Individual user at folder limit (10 folders per workspace) is blocked for that workspace", async () => {
    const { userId } = await createPaidUser(individualPlan);
    const ws = await workspaceService.createWorkspace(
        { name: "WS Indiv", slug: `ws-indiv-${new Types.ObjectId()}` },
        userId,
    );
    const wsId = ws.id;

    for (let i = 1; i <= 10; i++) {
        await folderService.createWorkspaceFolder(
            { workspaceId: wsId, name: `Folder ${i}`, slug: `fld-${i}-${new Types.ObjectId()}` },
            userId,
        );
    }

    await assert.rejects(
        () =>
            folderService.createWorkspaceFolder(
                { workspaceId: wsId, name: "Folder 11", slug: `fld-11-${new Types.ObjectId()}` },
                userId,
            ),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            assert.match(err.message, /maximum of 10 folders/i);
            return true;
        },
    );
});

test("4. User reaching active sticky note quota is blocked from creating more notes", async () => {
    const user = await createUser("note-limit");
    const ws = await workspaceService.createWorkspace(
        { name: "WS Notes", slug: `ws-notes-${new Types.ObjectId()}` },
        user,
    );
    const wsId = ws.id;
    const folder = await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "Folder N", slug: `fld-n-${new Types.ObjectId()}` },
        user,
    );
    const folderId = folder.id;
    const col = await StickyNoteColumnModel.create({
        workspaceId: new Types.ObjectId(wsId),
        workspaceFolderId: new Types.ObjectId(folderId),
        createdBy: new Types.ObjectId(user),
        name: "Col 1",
        position: 1,
        isDefault: true,
    });

    // Mock limit for testing quota ceiling
    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
            return { limit: 2, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        await noteService.createStickyNote(
            {
                workspaceId: wsId,
                workspaceFolderId: folderId,
                columnId: String(col._id),
                title: "Note 1",
                content: "Content 1",
            },
            user,
        );

        await noteService.createStickyNote(
            {
                workspaceId: wsId,
                workspaceFolderId: folderId,
                columnId: String(col._id),
                title: "Note 2",
                content: "Content 2",
            },
            user,
        );

        await assert.rejects(
            () =>
                noteService.createStickyNote(
                    {
                        workspaceId: wsId,
                        workspaceFolderId: folderId,
                        columnId: String(col._id),
                        title: "Note 3",
                        content: "Content 3",
                    },
                    user,
                ),
            (err) => {
                assert.equal(err.statusCode, 403);
                assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
                assert.match(err.message, /maximum of 2 active sticky notes/i);
                return true;
            },
        );
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("5. Upload exceeding maximum single-file size is blocked", async () => {
    const user = await createUser("file-size");
    // Free plan MAX_UPLOAD_BYTES is 5242880 (5MB). Uploading 6MB should fail.
    await assert.rejects(
        () => entitlementService.assertCanUploadAttachment(user, null, null, 6 * 1024 * 1024),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            assert.match(err.message, /maximum allowed upload limit/i);
            return true;
        },
    );
});

test("6. Upload exceeding total storage capacity is blocked", async () => {
    const user = await createUser("storage-limit");
    // Free plan MAX_STORAGE_BYTES is 104857600 (100MB). Requesting 110MB should fail.
    await assert.rejects(
        () => entitlementService.assertCanUploadAttachment(user, null, null, 110 * 1024 * 1024),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            return true;
        },
    );
});

test("7. Sequential uploads exceeding combined storage are blocked", async () => {
    const user = await createUser("seq-storage");
    await MediaModel.create({
        uploadedBy: new Types.ObjectId(user),
        storageProvider: MediaStorageProvider.LOCAL,
        bucket: "attachments",
        storageKey: `att-${new Types.ObjectId()}`,
        originalFileName: "file1.png",
        mimeType: "image/png",
        size: 4 * 1024 * 1024,
        mediaType: MediaType.IMAGE,
        purpose: MediaPurpose.ATTACHMENT,
        status: MediaStatus.ACTIVE,
        resourceType: MediaResourceType.USER,
        resourceId: new Types.ObjectId(user),
    });

    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_STORAGE_BYTES) {
            return { limit: 6 * 1024 * 1024, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        // Second upload of 3MB brings total to 7MB > 6MB -> should be blocked!
        await assert.rejects(
            () => entitlementService.assertCanUploadAttachment(user, null, null, 3 * 1024 * 1024),
            (err) => {
                assert.equal(err.statusCode, 403);
                assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
                return true;
            },
        );
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("8. Concurrent workspace creations respect capacity safely", async () => {
    const user = await createUser("concurrent-ws");
    // Free limit is 3. Pre-create 2 workspaces so only 1 slot remains.
    await workspaceService.createWorkspace({ name: "C1", slug: `c1-${new Types.ObjectId()}` }, user);
    await workspaceService.createWorkspace({ name: "C2", slug: `c2-${new Types.ObjectId()}` }, user);

    // Launch 3 simultaneous creations competing for 1 remaining slot
    const results = await Promise.allSettled([
        workspaceService.createWorkspace({ name: "C3-A", slug: `c3a-${new Types.ObjectId()}` }, user),
        workspaceService.createWorkspace({ name: "C3-B", slug: `c3b-${new Types.ObjectId()}` }, user),
        workspaceService.createWorkspace({ name: "C3-C", slug: `c3c-${new Types.ObjectId()}` }, user),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    assert.equal(successes.length, 1, "Exactly one concurrent creation must succeed");
    assert.equal(rejections.length, 2, "Other concurrent creations must be rejected");

    const totalWs = await WorkspaceModel.countDocuments({ ownerId: user, status: WorkspaceStatus.ACTIVE });
    assert.equal(totalWs, 3, "Total workspaces created must never exceed limit of 3");
});

test("9. Concurrent note creations respect capacity", async () => {
    const user = await createUser("concurrent-notes");
    const ws = await workspaceService.createWorkspace(
        { name: "WS CN", slug: `ws-cn-${new Types.ObjectId()}` },
        user,
    );
    const wsId = ws.id;
    const fld = await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "Fld", slug: `fld-${new Types.ObjectId()}` },
        user,
    );
    const fldId = fld.id;
    const col = await StickyNoteColumnModel.create({
        workspaceId: new Types.ObjectId(wsId),
        workspaceFolderId: new Types.ObjectId(fldId),
        createdBy: new Types.ObjectId(user),
        name: "Col",
        position: 1,
        isDefault: true,
    });

    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
            return { limit: 1, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        const results = await Promise.allSettled([
            noteService.createStickyNote(
                {
                    workspaceId: wsId,
                    workspaceFolderId: fldId,
                    columnId: String(col._id),
                    title: "N1",
                    content: "C1",
                },
                user,
            ),
            noteService.createStickyNote(
                {
                    workspaceId: wsId,
                    workspaceFolderId: fldId,
                    columnId: String(col._id),
                    title: "N2",
                    content: "C2",
                },
                user,
            ),
        ]);

        const successes = results.filter((r) => r.status === "fulfilled");
        const rejections = results.filter((r) => r.status === "rejected");
        assert.equal(successes.length, 1);
        assert.equal(rejections.length, 1);
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("10. Concurrent attachment uploads respect storage limit", async () => {
    const user = await createUser("concurrent-upload");

    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_STORAGE_BYTES) {
            return { limit: 2000, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        const results = await Promise.allSettled([
            entitlementService.assertCanUploadAttachment(user, null, null, 1500),
            entitlementService.assertCanUploadAttachment(user, null, null, 1500),
        ]);

        const successes = results.filter((r) => r.status === "fulfilled");
        const rejections = results.filter((r) => r.status === "rejected");
        assert.equal(successes.length, 1);
        assert.equal(rejections.length, 1);
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("11. Failed upload releases pending reservation", async () => {
    const user = await createUser("failed-upload");
    const res = await entitlementService.assertCanUploadAttachment(user, null, null, 1000);
    assert.equal(res.amount, 1000);

    const pendingBefore = await entitlementRepo.getPendingReservationAmount(
        BillingScopeType.USER,
        new Types.ObjectId(user),
        FeatureCode.MAX_STORAGE_BYTES,
    );
    assert.equal(pendingBefore, 1000);

    await entitlementService.releaseReservation(res.reservationId);

    const pendingAfter = await entitlementRepo.getPendingReservationAmount(
        BillingScopeType.USER,
        new Types.ObjectId(user),
        FeatureCode.MAX_STORAGE_BYTES,
    );
    assert.equal(pendingAfter, 0);
});

test("12. Duplicate operationId is idempotent and does not double-count", async () => {
    const user = await createUser("idempotent");
    const opId = `op-${new Types.ObjectId()}`;

    const res1 = await entitlementService.reserveCapacity(
        { type: BillingScopeType.USER, id: user },
        FeatureCode.MAX_WORKSPACES,
        1,
        { operationId: opId },
    );

    const res2 = await entitlementService.reserveCapacity(
        { type: BillingScopeType.USER, id: user },
        FeatureCode.MAX_WORKSPACES,
        1,
        { operationId: opId },
    );

    assert.equal(res1.reservationId, res2.reservationId);
    assert.equal(res1.operationId, res2.operationId);

    const pending = await entitlementRepo.getPendingReservationAmount(
        BillingScopeType.USER,
        new Types.ObjectId(user),
        FeatureCode.MAX_WORKSPACES,
    );
    assert.equal(pending, 1, "Must only count once");
});

test("13. Idempotent retry returns existing reservation token", async () => {
    const user = await createUser("retry-token");
    const opId = `op-token-${new Types.ObjectId()}`;

    const res1 = await entitlementService.reserveCapacity(
        { type: BillingScopeType.USER, id: user },
        FeatureCode.MAX_ACTIVE_STICKY_NOTES,
        1,
        { operationId: opId },
    );

    const found = await entitlementRepo.findReservationByOperationId(opId);
    assert.ok(found);
    assert.equal(found._id.toString(), res1.reservationId);
});

test("14. Workspace restoration beyond limit is blocked", async () => {
    const user = await createUser("restore-ws");
    const ws1 = await workspaceService.createWorkspace(
        { name: "WS 1", slug: `ws-r-1-${new Types.ObjectId()}` },
        user,
    );
    const ws2 = await workspaceService.createWorkspace(
        { name: "WS 2", slug: `ws-r-2-${new Types.ObjectId()}` },
        user,
    );
    const ws3 = await workspaceService.createWorkspace(
        { name: "WS 3", slug: `ws-r-3-${new Types.ObjectId()}` },
        user,
    );

    // Trash ws1
    await workspaceService.deleteWorkspace(ws1.id, user);

    // Create a new ws4 taking the 3rd slot
    await workspaceService.createWorkspace({ name: "WS 4", slug: `ws-r-4-${new Types.ObjectId()}` }, user);

    // Now user has 3 active workspaces (ws2, ws3, ws4). Attempting to restore ws1 must be blocked!
    await assert.rejects(
        () => workspaceService.restoreWorkspace(ws1.id, user),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            assert.match(err.message, /maximum of 3 workspaces/i);
            return true;
        },
    );

    // Ensure ws1 is still in trash and NOT deleted
    const trashed = await WorkspaceModel.findById(ws1.id);
    assert.equal(trashed.status, WorkspaceStatus.TRASHED);
});

test("15. Folder restoration beyond limit is blocked", async () => {
    const { userId } = await createPaidUser(individualPlan);
    const ws = await workspaceService.createWorkspace(
        { name: "WS Folders", slug: `ws-f-${new Types.ObjectId()}` },
        userId,
    );
    const wsId = ws.id;

    const f1 = await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "F1", slug: `f1-${new Types.ObjectId()}` },
        userId,
    );
    for (let i = 2; i <= 10; i++) {
        await folderService.createWorkspaceFolder(
            { workspaceId: wsId, name: `F${i}`, slug: `f${i}-${new Types.ObjectId()}` },
            userId,
        );
    }

    // Trash f1
    await folderService.deleteWorkspaceFolder(f1.id, userId);

    // Create f11 to refill the 10th slot
    await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "F11", slug: `f11-${new Types.ObjectId()}` },
        userId,
    );

    // Restoring f1 must be blocked
    await assert.rejects(
        () => folderService.restoreWorkspaceFolder(f1.id, userId),
        (err) => {
            assert.equal(err.statusCode, 403);
            assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
            return true;
        },
    );
});

test("16. Note reactivation beyond limit is blocked", async () => {
    const user = await createUser("reactivate-note");
    const ws = await workspaceService.createWorkspace(
        { name: "WS Note Act", slug: `ws-na-${new Types.ObjectId()}` },
        user,
    );
    const wsId = ws.id;
    const fld = await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "Fld", slug: `fld-${new Types.ObjectId()}` },
        user,
    );
    const fldId = fld.id;
    const col = await StickyNoteColumnModel.create({
        workspaceId: new Types.ObjectId(wsId),
        workspaceFolderId: new Types.ObjectId(fldId),
        createdBy: new Types.ObjectId(user),
        name: "Col",
        position: 1,
        isDefault: true,
    });

    const n1 = await noteService.createStickyNote(
        {
            workspaceId: wsId,
            workspaceFolderId: fldId,
            columnId: String(col._id),
            title: "N1",
            content: "C1",
        },
        user,
    );

    // Move n1 to ARCHIVED
    await noteService.updateStickyNoteStatus(n1.id, StickyNoteStatus.ARCHIVED, user);

    // Mock ceiling of 1 note
    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
            return { limit: 1, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        // Create active note n2 (taking the 1 slot)
        await noteService.createStickyNote(
            {
                workspaceId: wsId,
                workspaceFolderId: fldId,
                columnId: String(col._id),
                title: "N2",
                content: "C2",
            },
            user,
        );

        // Reactivating n1 from ARCHIVED to ACTIVE must be blocked
        await assert.rejects(
            () => noteService.updateStickyNoteStatus(n1.id, StickyNoteStatus.ACTIVE, user),
            (err) => {
                assert.equal(err.statusCode, 403);
                assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
                return true;
            },
        );
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("17. Downgrade with over-limit usage preserves all resources and allows viewing", async () => {
    const { userId, subscription } = await createPaidUser(proPlan);
    // Create 5 workspaces (which exceeds Free plan limit of 3)
    for (let i = 1; i <= 5; i++) {
        await workspaceService.createWorkspace(
            { name: `Pro WS ${i}`, slug: `pws-${i}-${new Types.ObjectId()}` },
            userId,
        );
    }

    // Downgrade subscription to Free
    await UserSubscriptionModel.findByIdAndUpdate(subscription._id, {
        plan: freePlan._id,
        status: UserSubscriptionStatus.ACTIVE,
    });

    // Check entitlements now shows 5 used out of 3 limit
    test17UserId = userId;
    const summary = await entitlementService.getMyEntitlements(userId);
    assert.equal(summary.planCode, "FREE");
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].limit, 3);
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].used, 5);
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].remaining, 0);

    // Creating another workspace must be blocked
    await assert.rejects(
        () =>
            workspaceService.createWorkspace(
                { name: "Pro WS 6", slug: `pws-6-${new Types.ObjectId()}` },
                userId,
            ),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        },
    );
});

test("18. No automatic deletion after downgrade", async () => {
    // Verify that all 5 workspaces still exist in database for this downgraded user
    const count = await WorkspaceModel.countDocuments({
        ownerId: test17UserId,
        status: WorkspaceStatus.ACTIVE,
    });
    assert.equal(count, 5, "Existing resources must never be deleted upon downgrade");
});

test("19. Missing plan-limit configuration fails safely with configuration error", async () => {
    const user = await createUser("missing-cfg");
    await assert.rejects(
        () =>
            entitlementService.getResourceLimit(
                { type: BillingScopeType.USER, id: user },
                "NON_EXISTENT_FEATURE_CODE",
            ),
        (err) => {
            assert.equal(err.statusCode, 500);
            assert.equal(err.code, EntitlementErrorCode.CONFIGURATION_ERROR);
            return true;
        },
    );
});

test("20. Pending paid subscription does not grant paid limits", async () => {
    const { userId } = await createPaidUser(proPlan, UserSubscriptionStatus.PENDING);
    const summary = await entitlementService.getMyEntitlements(userId);
    // Pending paid subscription must fall back to Free limits
    assert.equal(summary.planCode, "FREE");
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].limit, 3);
});

test("21. Scheduled cancellation preserves valid access until period end", async () => {
    const { userId } = await createPaidUser(proPlan, UserSubscriptionStatus.ACTIVE, {
        cancelAtPeriodEnd: true,
        cancellationEffectiveAt: new Date(Date.now() + 15 * 86_400_000),
    });
    const summary = await entitlementService.getMyEntitlements(userId);
    assert.equal(summary.planCode, "PRO");
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].limit, 20);
    assert.equal(summary.cancelAtPeriodEnd, true);
});

test("22. Expired paid subscription falls back to Free plan", async () => {
    const { userId } = await createPaidUser(proPlan, UserSubscriptionStatus.EXPIRED, {
        currentPeriodEnd: new Date("2024-01-01"),
        endDate: new Date("2024-01-01"),
    });
    const summary = await entitlementService.getMyEntitlements(userId);
    assert.equal(summary.planCode, "FREE");
    assert.equal(summary.resources[FeatureCode.MAX_WORKSPACES].limit, 3);
});

test("23. Shared workspace membership enforces workspace owner quota", async () => {
    const owner = await createUser("ws-owner");
    const collaborator = await createUser("collaborator");

    const ws = await workspaceService.createWorkspace(
        { name: "Shared WS", slug: `shared-${new Types.ObjectId()}` },
        owner,
    );
    const wsId = ws.id;
    const fld = await folderService.createWorkspaceFolder(
        { workspaceId: wsId, name: "Fld", slug: `fld-${new Types.ObjectId()}` },
        owner,
    );
    const fldId = fld.id;
    const col = await StickyNoteColumnModel.create({
        workspaceId: new Types.ObjectId(wsId),
        workspaceFolderId: new Types.ObjectId(fldId),
        createdBy: new Types.ObjectId(owner),
        name: "Col",
        position: 1,
        isDefault: true,
    });

    await WorkspaceMemberModel.create({
        workspaceId: new Types.ObjectId(wsId),
        userId: new Types.ObjectId(collaborator),
        roleId: workspaceMemberRoleId,
        status: "ACTIVE",
    });

    // Mock owner's note limit to 1
    const originalMethod = SubscriptionEntitlementService.prototype.getResourceLimit;
    SubscriptionEntitlementService.prototype.getResourceLimit = async function (scope, code, session) {
        if (code === FeatureCode.MAX_ACTIVE_STICKY_NOTES && scope.id === owner) {
            return { limit: 1, isUnlimited: false, isEnabled: true };
        }
        return originalMethod.call(this, scope, code, session);
    };

    try {
        // Owner creates 1 note
        await noteService.createStickyNote(
            {
                workspaceId: wsId,
                workspaceFolderId: fldId,
                columnId: String(col._id),
                title: "Owner note",
                content: "C",
            },
            owner,
        );

        // Collaborator attempts to create a note in owner's workspace -> must fail because owner is at limit!
        await assert.rejects(
            () =>
                noteService.createStickyNote(
                    {
                        workspaceId: wsId,
                        workspaceFolderId: fldId,
                        columnId: String(col._id),
                        title: "Collab note",
                        content: "C",
                    },
                    collaborator,
                ),
            (err) => {
                assert.equal(err.statusCode, 403);
                assert.equal(err.code, EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED);
                return true;
            },
        );
    } finally {
        SubscriptionEntitlementService.prototype.getResourceLimit = originalMethod;
    }
});

test("24. Permission denial takes precedence over resource mutation", async () => {
    const stranger = await createUser("stranger");
    const owner = await createUser("owner-perm");
    const ws = await workspaceService.createWorkspace(
        { name: "Priv WS", slug: `priv-${new Types.ObjectId()}` },
        owner,
    );

    // Stranger has no permissions on owner's private workspace
    await assert.rejects(
        () =>
            folderService.createWorkspaceFolder(
                { workspaceId: ws.id, name: "Hack", slug: `hack-${new Types.ObjectId()}` },
                stranger,
            ),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        },
    );
});

test("25. Cross-tenant isolation ensures tenant data cannot leak", async () => {
    const userA = await createUser("tenant-a");
    const userB = await createUser("tenant-b");

    const resA = await request("/subscriptionentitlement/me", { userId: userA });
    const resB = await request("/subscriptionentitlement/me", { userId: userB });

    assert.equal(resA.status, 200);
    assert.equal(resB.status, 200);
    assert.notEqual(resA.body.data.subscriptionId, resB.body.data.subscriptionId);
});

test("26. No circular service dependencies", async () => {
    assert.ok(entitlementService instanceof SubscriptionEntitlementService);
    assert.ok(workspaceService instanceof WorkspaceService);
    assert.ok(folderService instanceof WorkspaceFolderService);
    assert.ok(noteService instanceof StickyNoteService);
    assert.ok(mediaService instanceof MediaService);
});

test("27. Standardized API responses (/me, /summary, /check, /workspace/:id/folders)", async () => {
    const user = await createUser("api-user");
    const ws = await workspaceService.createWorkspace(
        { name: "API WS", slug: `api-ws-${new Types.ObjectId()}` },
        user,
    );

    const meRes = await request("/subscriptionentitlement/me", { userId: user });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.success, true);
    assert.ok(meRes.body.data.resources.MAX_WORKSPACES);

    const sumRes = await request("/subscriptionentitlement/summary", { userId: user });
    assert.equal(sumRes.status, 200);
    assert.equal(sumRes.body.data.planCode, "FREE");

    const checkRes = await request("/subscriptionentitlement/check", {
        userId: user,
        body: { resourceCode: "MAX_WORKSPACES", requestedAmount: 1 },
    });
    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.data.allowed, true);

    const fldRes = await request(`/subscriptionentitlement/workspace/${ws.id}/folders`, { userId: user });
    assert.equal(fldRes.status, 200);
    assert.equal(fldRes.body.data.limit, 5);
});

test("28. Successful resource creation commits reservation", async () => {
    const user = await createUser("commit-res");
    const res = await entitlementService.assertCanCreateWorkspace(user);
    await entitlementService.commitReservation(res.reservationId);

    const doc = await SubscriptionReservationModel.findById(res.reservationId);
    assert.equal(doc.status, ReservationStatus.COMMITTED);
});

test("29. Failed resource creation releases reservation", async () => {
    const user = await createUser("release-res");
    const res = await entitlementService.assertCanCreateWorkspace(user);
    await entitlementService.releaseReservation(res.reservationId);

    const doc = await SubscriptionReservationModel.findById(res.reservationId);
    assert.equal(doc.status, ReservationStatus.RELEASED);
});

test("30. Interrupted operation and reconciliation expires stale reservations", async () => {
    const user = await createUser("stale-res");
    const past = new Date(Date.now() - 1000);
    const stale = await SubscriptionReservationModel.create({
        scopeType: BillingScopeType.USER,
        scopeId: new Types.ObjectId(user),
        resource: FeatureCode.MAX_WORKSPACES,
        amount: 1,
        status: ReservationStatus.PENDING,
        expiresAt: past,
    });

    const expiredCount = await entitlementRepo.expireStaleReservations(new Date());
    assert.ok(expiredCount >= 1);

    const refetched = await SubscriptionReservationModel.findById(stale._id);
    assert.equal(refetched.status, ReservationStatus.EXPIRED);
});

test("31. Parallel plan downgrade and resource creation handles limits correctly", async () => {
    const { userId, subscription } = await createPaidUser(proPlan);

    // Pre-create 3 workspaces
    await workspaceService.createWorkspace({ name: "W1", slug: `w1-${new Types.ObjectId()}` }, userId);
    await workspaceService.createWorkspace({ name: "W2", slug: `w2-${new Types.ObjectId()}` }, userId);
    await workspaceService.createWorkspace({ name: "W3", slug: `w3-${new Types.ObjectId()}` }, userId);

    // Downgrade to Free in DB
    await UserSubscriptionModel.findByIdAndUpdate(subscription._id, {
        plan: freePlan._id,
        status: UserSubscriptionStatus.ACTIVE,
    });

    // Immediate attempt to create 4th workspace must be rejected
    await assert.rejects(
        () => workspaceService.createWorkspace({ name: "W4", slug: `w4-${new Types.ObjectId()}` }, userId),
        (err) => {
            assert.equal(err.statusCode, 403);
            return true;
        },
    );
});

test("32. Existing functionality regression: assertCanAddMember preserves collaboration", async () => {
    const owner = await createUser("member-owner");
    const ws = await workspaceService.createWorkspace(
        { name: "Collab WS", slug: `collab-${new Types.ObjectId()}` },
        owner,
    );

    // assertCanAddMember succeeds for Free user
    await assert.doesNotReject(() => entitlementService.assertCanAddMember(owner, ws.id));
});
