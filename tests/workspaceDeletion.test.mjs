import { seedProductSubscriptionFixtures } from "./helpers/subscriptionFixtures.mjs";
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
import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceRepository } from "../src/modules/workspace/repositories/workspace.repository.ts";
import { WorkspaceService } from "../src/modules/workspace/services/workspace.service.ts";
import { WorkspacePurgeService } from "../src/modules/workspace/services/workspacePurge.service.ts";
import { workspaceListSchema } from "../src/modules/workspace/validations/workspaceList.schema.ts";
import { permissionAuthorizationService } from "../src/modules/permissions/services/permissionAuthorization.service.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { WorkspaceFolderService } from "../src/modules/workspaceFolders/services/workspaceFolder.service.ts";
import { StickyNoteColumnService } from "../src/modules/stickynotescolumns/services/stickyNoteColumn.service.ts";
import { StickyNoteLabelService } from "../src/modules/stickynotelabels/services/stickyNoteLabel.service.ts";
import { StickyNoteChecklistService } from "../src/modules/stickyNoteschecklist/services/stickyNoteChecklist.service.ts";
import { StickyNoteChecklistItemService } from "../src/modules/stickynotechecklistitems/services/stickyNoteChecklistItem.service.ts";
import { RoleService } from "../src/modules/roles/services/role.service.ts";
import { MediaRepository } from "../src/modules/media/repositories/media.repository.ts";
import { StickyNoteFavoriteService } from "../src/modules/stickynotesfavorites/services/stickyNoteFavorite.service.ts";
import { StickyNoteAssigneeService } from "../src/modules/stickynotesassignees/services/stickyNoteAssignee.service.ts";
import { WorkspaceMemberService } from "../src/modules/workspaceMember/services/workspaceMember.service.ts";
import { WorkspaceMemberInvitationRepository } from "../src/modules/workspaceInvitations/repositories/workspaceMemberInvitation.repository.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "workspace-delete-test";
process.env.JWT_REFRESH_SECRET = "workspace-delete-test-refresh";
for (const key of ["ACCOUNT_ID", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"])
    process.env[`CLOUDFLARE_R2_${key}`] = "workspace-test";
process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://files.example.test";
const { CloudflareR2Service } = await import("../src/modules/media/storage/cloudflareR2.service.ts");
const { MediaService } = await import("../src/modules/media/services/media.service.ts");
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: workspaceRoutes } = await import("../src/modules/workspace/routes/workspace.routes.ts");

let mongoProcess,
    mongoDirectory,
    server,
    baseUrl,
    storageFails = false;
const deletedKeys = [];
const owner = new Types.ObjectId(),
    outsider = new Types.ObjectId();
const service = new WorkspaceService(),
    repository = new WorkspaceRepository();
const models = () => mongoose.models;
const failure = (status) => (error) => error.statusCode === status;

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    mongoDirectory = await mkdtemp(join(tmpdir(), "workspace-delete-test-"));
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
            "workspaceTest",
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
            await mongoose.connect(
                `mongodb://127.0.0.1:${port}/workspace_delete_test?directConnection=true`,
                { serverSelectionTimeoutMS: 500, autoIndex: false },
            );
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }
    await mongoose.connection.db.admin().command({
        replSetInitiate: { _id: "workspaceTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });
    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        if (attempt >= 80) throw new Error("Replica set did not elect a primary");
        await delay(250);
    }
    for (const model of Object.values(models())) await model.createCollection();
    mock.method(AuditLogService.prototype, "logDelete", async () => {});
    mock.method(AuditLogService.prototype, "log", async () => {});
    mock.method(CloudflareR2Service.prototype, "deleteObject", async (key) => {
        if (storageFails) throw new Error("Storage unavailable");
        deletedKeys.push(key);
    });
    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));
    const app = express();
    app.use(express.json());
    app.use(workspaceRoutes);
    app.use(errorMiddleware);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    await seedProductSubscriptionFixtures();
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    mock.restoreAll();
    await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) {
        const stopped = once(mongoProcess, "exit");
        mongoProcess.kill();
        await stopped;
    }
    if (mongoDirectory) {
        const target = resolve(mongoDirectory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("workspace-delete-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

async function workspace(extra = {}) {
    return WorkspaceModel.create({
        name: "Lifecycle",
        slug: new Types.ObjectId().toString(),
        ownerId: owner,
        createdBy: owner,
        ...extra,
    });
}
async function request(method, path, user = owner, body) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: { Authorization: `Bearer ${user}`, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
}
async function fixture(ws) {
    const workspaceId = ws._id;
    const ids = Object.fromEntries(
        [
            "note",
            "folder",
            "column",
            "checklist",
            "item",
            "label",
            "role",
            "member",
            "invitation",
            "media",
        ].map((key) => [key, new Types.ObjectId()]),
    );
    const rows = {
        WorkspaceFolder: {
            _id: ids.folder,
            workspaceId,
            name: "Folder",
            slug: "folder",
            status: "ACTIVE",
            isDefault: true,
        },
        StickyNoteColumn: {
            _id: ids.column,
            workspaceId,
            workspaceFolderId: ids.folder,
            name: "Todo",
            type: "TODO",
        },
        StickyNote: {
            _id: ids.note,
            workspaceId,
            workspaceFolderId: ids.folder,
            columnId: ids.column,
            title: "Preserved",
            status: "ACTIVE",
            createdBy: owner,
        },
        StickyNoteCounter: { workspaceId, key: "STICKY_NOTE", sequence: 7 },
        StickyNoteChecklist: {
            _id: ids.checklist,
            stickyNoteId: ids.note,
            title: "Checklist",
            status: "ACTIVE",
        },
        StickyNoteChecklistItem: {
            _id: ids.item,
            checklistId: ids.checklist,
            title: "Item",
            status: "ACTIVE",
        },
        StickyNoteAssignee: { workspaceId, stickyNoteId: ids.note, userId: owner, status: "ACTIVE" },
        StickyNoteFavorite: { stickyNoteId: ids.note, userId: owner, status: "ACTIVE" },
        StickyNoteLabel: { _id: ids.label, workspaceId, name: "Label", slug: "label", status: "ACTIVE" },
        Role: {
            _id: ids.role,
            workspaceId,
            name: "custom",
            code: "CUSTOM",
            isSystem: false,
            isActive: true,
            permissions: [],
        },
        WorkspaceMember: { _id: ids.member, workspaceId, userId: outsider, status: "ACTIVE" },
        WorkspaceMemberInvitation: {
            _id: ids.invitation,
            workspaceId,
            roleId: ids.role,
            email: "invited@example.test",
            status: "PENDING",
        },
        Media: {
            _id: ids.media,
            resourceType: "NOTE",
            resourceId: ids.note,
            uploadedBy: owner,
            status: "ACTIVE",
            bucket: "workspace-test",
            storageKey: `note/${ids.note}`,
        },
    };
    for (const [name, row] of Object.entries(rows)) await models()[name].collection.insertOne(row);
    return { ids, rows };
}

test("trash/restore preserves every child and relationship, sets 60 days, rejects invalid transitions", async () => {
    const ws = await workspace({ status: "ARCHIVED" });
    const { rows } = await fixture(ws);
    const before = new Date();
    const trashed = await service.deleteWorkspace(String(ws._id), String(owner));
    assert.equal(trashed.status, "TRASHED");
    assert.equal(trashed.deletedBy, String(owner));
    assert.ok(trashed.deletedAt >= before);
    assert.equal(trashed.purgeAfter - trashed.deletedAt, 60 * 86400000);
    await assert.rejects(service.deleteWorkspace(String(ws._id), String(owner)), failure(400));
    assert.equal(await repository.findById(String(ws._id)), null);
    assert.equal((await repository.findAccessibleIds(String(owner), String(ws._id))).length, 0);
    const restored = await service.restoreWorkspace(String(ws._id), String(owner));
    assert.equal(restored.status, "ACTIVE");
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.deletedBy, null);
    assert.equal(restored.purgeAfter, null);
    await assert.rejects(service.restoreWorkspace(String(ws._id), String(owner)), failure(400));
    await assert.rejects(service.permanentlyDeleteWorkspace(String(ws._id), String(owner)), failure(400));
    for (const [name, row] of Object.entries(rows))
        assert.deepEqual(await models()[name].collection.findOne({ _id: row._id }), row);
});

test("permission checks protect all lifecycle operations and personal workspaces", async () => {
    const ws = await workspace();
    await fixture(ws);
    for (const user of [outsider, new Types.ObjectId()])
        await assert.rejects(service.deleteWorkspace(String(ws._id), String(user)), failure(403));
    await service.deleteWorkspace(String(ws._id), String(owner));
    await assert.rejects(service.restoreWorkspace(String(ws._id), String(outsider)), failure(403));
    await assert.rejects(service.permanentlyDeleteWorkspace(String(ws._id), String(outsider)), failure(403));
    await assert.rejects(service.deleteWorkspace("bad-id", String(owner)), failure(404));
    await assert.rejects(service.deleteWorkspace(String(ws._id), ""), failure(401));
    const personal = await workspace({ isPersonal: true });
    await assert.rejects(service.deleteWorkspace(String(personal._id), String(owner)), failure(400));
});

test("expired restore is rejected atomically; legacy deleted workspaces remain recoverable", async () => {
    const expired = await workspace({ status: "TRASHED", purgeAfter: new Date(Date.now() - 1) });
    await assert.rejects(service.restoreWorkspace(String(expired._id), String(owner)), failure(410));
    assert.equal(await repository.restore(String(expired._id), owner), null);
    const legacy = await workspace({ status: "DELETED" });
    await WorkspaceModel.collection.updateOne(
        { _id: legacy._id },
        { $unset: { deletedAt: "", deletedBy: "", purgeAfter: "" } },
    );
    assert.ok(!(await repository.findExpiredTrashedIds()).includes(String(legacy._id)));
    assert.equal((await service.restoreWorkspace(String(legacy._id), String(owner))).status, "ACTIVE");
});

test("trashed data is blocked through normal child access and unscoped lists", async () => {
    const ws = await workspace();
    const { ids } = await fixture(ws);
    await service.deleteWorkspace(String(ws._id), String(owner));
    const checks = [
        () => permissionAuthorizationService.resolveWorkspaceAuthorization(String(owner), String(ws._id)),
        () => new WorkspaceFolderService().getWorkspaceFolderById(String(ids.folder), String(owner)),
        () => new StickyNoteColumnService().getStickyNoteColumnById(String(ids.column)),
        () => new StickyNoteLabelService().getStickyNoteLabelById(String(ids.label)),
        () => new StickyNoteChecklistService().getStickyNoteChecklistById(String(ids.checklist)),
        () => new StickyNoteChecklistItemService().getStickyNoteChecklistItemById(String(ids.item)),
        () => new RoleService().getRoleById(String(ids.role)),
        () => new MediaService().getMedia(String(ids.media), String(owner)),
        () => new StickyNoteFavoriteService().getStickyNoteFavoriteById(String(ids.note), String(owner)),
        () => new StickyNoteAssigneeService().getAssigneesByStickyNoteId(String(ids.note), String(owner)),
        () => new WorkspaceMemberService().getWorkspaceMemberById(String(ids.member), String(owner)),
    ];
    for (const check of checks)
        await assert.rejects(check(), (error) => [400, 404].includes(error.statusCode));
    const folders = await new WorkspaceFolderService().getMyWorkspaceFolders(String(outsider));
    assert.ok(!folders.data.some((row) => row.workspaceId === String(ws._id)));
    const labels = await new StickyNoteLabelService().getStickyNoteLabels({ limit: 100 });
    assert.ok(!labels.data.some((row) => String(row._id) === String(ids.label)));
    const media = await new MediaRepository().findAll({ uploadedBy: owner, limit: 100 });
    assert.ok(!media.data.some((row) => String(row._id) === String(ids.media)));
    const favorites = await new StickyNoteFavoriteService().getStickyNoteFavorites(String(owner), {
        limit: 100,
    });
    assert.ok(
        !favorites.data.some((row) => String(row.stickyNoteId?._id ?? row.stickyNoteId) === String(ids.note)),
    );
    const invitations = await new WorkspaceMemberInvitationRepository().findAll({ limit: 100 });
    assert.ok(!invitations.data.some((row) => String(row._id) === String(ids.invitation)));
});

test("permanent delete cleans owned records and storage while preserving another workspace and shared catalogs", async () => {
    const ws = await workspace();
    const own = await fixture(ws);
    const other = await workspace();
    const unrelated = await fixture(other);
    const sharedRole = await models().Role.collection.insertOne({
        code: "SHARED",
        workspaceId: null,
        isSystem: true,
    });
    await service.deleteWorkspace(String(ws._id), String(owner));
    const result = await service.permanentlyDeleteWorkspace(String(ws._id), String(owner));
    assert.equal(result.deletedWorkspaces, 1);
    assert.equal(result.deletedStickyNotes, 1);
    assert.equal(result.deletedChecklistItems, 1);
    for (const [name, row] of Object.entries(own.rows))
        assert.equal(await models()[name].collection.findOne({ _id: row._id }), null, name);
    for (const [name, row] of Object.entries(unrelated.rows))
        assert.deepEqual(await models()[name].collection.findOne({ _id: row._id }), row, name);
    assert.ok(await models().Role.findById(sharedRole.insertedId));
    assert.ok(deletedKeys.includes(own.rows.Media.storageKey));
    assert.ok(!deletedKeys.includes(unrelated.rows.Media.storageKey));
});

test("failed cleanup rolls back all MongoDB changes", async () => {
    const ws = await workspace();
    const { rows } = await fixture(ws);
    await service.deleteWorkspace(String(ws._id), String(owner));
    const original = WorkspaceRepository.prototype.deleteDependentData;
    const stub = mock.method(WorkspaceRepository.prototype, "deleteDependentData", async function (...args) {
        await original.apply(this, args);
        throw new Error("Injected transaction failure");
    });
    await assert.rejects(
        service.permanentlyDeleteWorkspace(String(ws._id), String(owner)),
        /Injected transaction failure/,
    );
    stub.mock.restore();
    assert.equal((await WorkspaceModel.findById(ws._id)).status, "TRASHED");
    for (const [name, row] of Object.entries(rows))
        assert.deepEqual(await models()[name].collection.findOne({ _id: row._id }), row, name);
    assert.ok(!deletedKeys.includes(rows.Media.storageKey));
});

test("storage failures retain a detached tombstone and succeed on retry", async () => {
    const ws = await workspace();
    const { ids, rows } = await fixture(ws);
    await service.deleteWorkspace(String(ws._id), String(owner));
    storageFails = true;
    try {
        await service.permanentlyDeleteWorkspace(String(ws._id), String(owner));
    } finally {
        storageFails = false;
    }
    const pending = await models().Media.findById(ids.media);
    assert.equal(pending.status, "DELETED");
    assert.equal(pending.storageDeletionPending, true);
    assert.equal(pending.resourceId, null);
    await new WorkspacePurgeService().cleanupDeletedMedia();
    assert.equal(await models().Media.findById(ids.media), null);
    assert.ok(deletedKeys.includes(rows.Media.storageKey));
});

test("cross-workspace role references block purge without changing either workspace", async () => {
    const ws = await workspace();
    const { ids } = await fixture(ws);
    const other = await workspace();
    await models().WorkspaceMember.collection.insertOne({
        workspaceId: other._id,
        userId: owner,
        roleId: ids.role,
    });
    await service.deleteWorkspace(String(ws._id), String(owner));
    await assert.rejects(service.permanentlyDeleteWorkspace(String(ws._id), String(owner)), failure(409));
    assert.ok(await models().Role.findById(ids.role));
    assert.ok(await WorkspaceModel.findById(other._id));
});

test("HTTP aliases, response envelopes, status bypass protection, and trash filters", async () => {
    const ws = await workspace();
    const id = String(ws._id);
    assert.equal((await request("PUT", `/status/${id}`, owner, { status: "TRASHED" })).status, 400);
    assert.equal((await request("PUT", `/trash/${id}`, outsider)).status, 403);
    const trash = await request("PUT", `/trash/${id}`);
    assert.equal(trash.status, 200);
    assert.match(trash.body.message, /moved to trash/);
    for (const status of ["TRASHED", "DELETED"]) {
        const list = await repository.listAccessible(
            String(owner),
            workspaceListSchema.parse({ status, limit: 100 }),
        );
        assert.ok(list.data.some((row) => String(row._id) === id));
    }
    assert.ok(
        !(
            await repository.listAccessible(
                String(owner),
                workspaceListSchema.parse({ status: "ALL", limit: 100 }),
            )
        ).data.some((row) => String(row._id) === id),
    );
    assert.equal((await request("PUT", `/restore/${id}`)).body.data.status, "ACTIVE");
    assert.equal((await request("DELETE", `/delete/${id}`)).status, 200);
    assert.equal((await request("DELETE", `/permanent/${id}`)).body.data.deletedWorkspaces, 1);
});

test("retention purges only expired non-personal trash in bounded batches", async () => {
    const now = new Date();
    const expired = await workspace({ status: "TRASHED", purgeAfter: new Date(now - 1000) });
    const future = await workspace({ status: "TRASHED", purgeAfter: new Date(+now + 60000) });
    const active = await workspace({ purgeAfter: new Date(now - 1000) });
    const legacy = await workspace({ status: "DELETED" });
    const personal = await workspace({
        isPersonal: true,
        status: "TRASHED",
        purgeAfter: new Date(now - 1000),
    });
    const ids = await repository.findExpiredTrashedIds(now, 100);
    assert.ok(ids.includes(String(expired._id)));
    for (const ws of [future, active, legacy, personal]) assert.ok(!ids.includes(String(ws._id)));
    assert.equal((await repository.findExpiredTrashedIds(now, 1)).length, 1);
    const result = await service.purgeExpiredWorkspaces(now, 100);
    assert.equal(result.failed, 0);
    assert.equal(await WorkspaceModel.findById(expired._id), null);
    for (const ws of [future, active, legacy, personal]) assert.ok(await WorkspaceModel.findById(ws._id));
});
