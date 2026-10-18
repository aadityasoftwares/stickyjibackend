import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { WorkspaceFolderService } from "../src/modules/workspaceFolders/services/workspaceFolder.service.ts";
import { WorkspaceFolderRepository } from "../src/modules/workspaceFolders/repositories/workspaceFolder.repository.ts";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickyNote.model.ts";
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { AuditLogModel } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
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
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { WorkspaceService } from "../src/modules/workspace/services/workspace.service.ts";
import { UserModel } from "../src/modules/user/models/user.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { seedPermissions } from "../src/modules/permissions/seeders/permission.seeder.ts";
import { seedRoles } from "../src/modules/roles/seeders/role.seeder.ts";
import { permissionAuthorizationService } from "../src/modules/permissions/services/permissionAuthorization.service.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "workspace-permission-test";
process.env.JWT_REFRESH_SECRET = "workspace-permission-test-refresh";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: folderRoutes } =
    await import("../src/modules/workspaceFolders/routes/workspaceFolder.routes.ts");
let mongoProcess, directory, server, baseUrl;
const users = Object.fromEntries(
    ["owner", "admin", "editor", "viewer", "stranger", "removed", "inactive", "empty", "own", "foreign"].map(
        (name) => [name, new Types.ObjectId()],
    ),
);
const roles = {};
const permissionIds = {};
const service = new WorkspaceFolderService();

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    directory = await mkdtemp(join(tmpdir(), "workspace-folders-test-"));
    mongoProcess = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            directory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--replSet",
            "workspaceFolders",
            "--logpath",
            join(directory, "mongo.log"),
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/workspace_folders?directConnection=true`, {
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
        replSetInitiate: { _id: "workspaceFolders", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });
    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        assert.ok(attempt < 80);
        await delay(250);
    }
    for (const model of Object.values(mongoose.models)) await model.createCollection();
    await seedPermissions();
    await seedRoles();
    for (const p of await PermissionModel.find().lean()) permissionIds[p.code] = p._id;
    for (const r of await RoleModel.find().lean()) roles[r.code] = r._id;
    roles.GLOBAL_READONLY = (
        await RoleModel.create({
            name: "global-readonly",
            displayName: "Read only",
            code: "GLOBAL_READONLY",
            scope: "GLOBAL",
            permissions: [],
            isActive: true,
        })
    )._id;
    roles.editor = (
        await RoleModel.create({
            name: "editor",
            displayName: "Editor",
            code: "TEST_EDITOR",
            scope: "WORKSPACE",
            isSystem: true,
            isActive: true,
            permissions: [
                permissionIds.WORKSPACE_READ,
                permissionIds.FOLDERS_READ,
                permissionIds.FOLDERS_CREATE,
                permissionIds.FOLDERS_UPDATE,
            ],
        })
    )._id;
    roles.empty = (
        await RoleModel.create({
            name: "empty",
            displayName: "Empty",
            code: "TEST_EMPTY",
            scope: "WORKSPACE",
            isSystem: true,
            isActive: true,
            permissions: [],
        })
    )._id;
    roles.inactive = (
        await RoleModel.create({
            name: "inactive",
            displayName: "Inactive",
            code: "TEST_INACTIVE",
            scope: "WORKSPACE",
            isSystem: true,
            isActive: false,
            permissions: [
                permissionIds.WORKSPACE_READ,
                permissionIds.WORKSPACE_UPDATE,
                permissionIds.WORKSPACE_DELETE,
            ],
        })
    )._id;
    const ownPermissions = [];
    for (const action of ["READ", "UPDATE", "DELETE", "SETTINGS", "ARCHIVE"]) {
        ownPermissions.push(
            (
                await PermissionModel.create({
                    name: `workspace_${action.toLowerCase()}_own`,
                    displayName: action,
                    code: `WORKSPACE_${action}_OWN`,
                    module: "WORKSPACE",
                    action,
                    access: "OWN",
                    isActive: true,
                })
            )._id,
        );
    }
    roles.own = (
        await RoleModel.create({
            name: "own",
            displayName: "Own",
            code: "TEST_OWN",
            scope: "WORKSPACE",
            isSystem: true,
            permissions: ownPermissions,
        })
    )._id;
    roles.foreign = (
        await RoleModel.create({
            name: "foreign",
            displayName: "Foreign",
            code: "TEST_FOREIGN",
            scope: "WORKSPACE",
            workspaceId: new Types.ObjectId(),
            isSystem: false,
            isActive: true,
            permissions: [
                permissionIds.WORKSPACE_READ,
                permissionIds.WORKSPACE_UPDATE,
                permissionIds.WORKSPACE_DELETE,
            ],
        })
    )._id;
    for (const [name, _id] of Object.entries(users))
        await UserModel.create({
            _id,
            email: `${name}@workspace.test`,
            status: "ACTIVE",
            globalRoleId: name === "owner" ? roles.USER : roles.GLOBAL_READONLY,
        });
    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));
    const app = express();
    app.use(express.json());
    app.use(folderRoutes);
    app.use(errorMiddleware);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
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
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("workspace-folders-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

async function fixture(status = "ACTIVE", name = new Types.ObjectId().toString()) {
    const ws = await WorkspaceModel.create({
        name,
        slug: new Types.ObjectId().toString(),
        ownerId: users.owner,
        status,
    });
    for (const actor of ["admin", "editor", "viewer", "removed", "inactive", "empty", "own", "foreign"]) {
        const roleId = roles[actor] ?? roles[actor === "admin" ? "WORKSPACE_ADMIN" : "WORKSPACE_VIEWER"];
        await WorkspaceMemberModel.create({
            workspaceId: ws._id,
            userId: users[actor],
            roleId,
            status: actor === "removed" ? "REMOVED" : "ACTIVE",
        });
    }
    return ws;
}
async function request(method, path, actor = "owner", body) {
    const response = await fetch(baseUrl + path, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${users[actor] ?? actor}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
}

async function folder(workspace, status = "ACTIVE", extra = {}) {
    return WorkspaceFolderModel.create({
        workspaceId: workspace._id,
        name: "Folder",
        slug: new Types.ObjectId().toString(),
        status,
        createdBy: users.owner,
        updatedBy: users.owner,
        ...extra,
    });
}

test("create permissions and protected fields; default provisioning still works", async () => {
    const ws = await fixture();
    for (const actor of [
        "owner",
        "admin",
        "editor",
        "viewer",
        "stranger",
        "removed",
        "inactive",
        "empty",
        "own",
        "foreign",
    ]) {
        const result = await request("POST", "/create", actor, { workspaceId: String(ws._id), name: actor });
        assert.equal(
            result.status,
            ["owner", "admin", "editor"].includes(actor) ? 201 : 403,
            JSON.stringify(result),
        );
    }
    for (const field of ["isDefault", "status", "createdBy", "deletedAt", "purgeAfter", "permissions"]) {
        assert.equal(
            (
                await request("POST", "/create", "owner", {
                    workspaceId: String(ws._id),
                    name: "Protected",
                    [field]: true,
                })
            ).status,
            400,
        );
    }
    const result = await service.createDefaultWorkspaceFolder(
        { workspaceId: String(ws._id), name: "Default", slug: "default" },
        String(users.owner),
    );
    assert.equal(result.isDefault, true);
    const legacy = await request("POST", "/create", "owner", {
        workspaceId: String(ws._id),
        name: "Null slug",
        slug: null,
    });
    assert.equal(legacy.status, 201);
    assert.equal(legacy.body.data.slug, "null-slug");
});

const operations = [
    ["GET", "get", undefined, "ACTIVE", ["owner", "admin", "editor", "viewer"]],
    ["PUT", "update", { name: "Changed" }, "ACTIVE", ["owner", "admin", "editor"]],
    ["PUT", "status", { status: "ARCHIVED" }, "ACTIVE", ["owner", "admin", "editor"]],
    ["PUT", "trash", undefined, "ACTIVE", ["owner", "admin"]],
    ["DELETE", "delete", undefined, "ACTIVE", ["owner", "admin"]],
    ["PUT", "restore", undefined, "DELETED", ["owner", "admin", "editor"]],
    ["DELETE", "permanent", undefined, "DELETED", ["owner", "admin"]],
];

test("folder action metadata follows workspace roles on detail, lists and mutations", async () => {
    const ws = await fixture();
    const f = await folder(ws);
    for (const actor of ["owner", "admin", "editor", "viewer"]) {
        const detail = await request("GET", `/get/${f._id}`, actor);
        assert.equal(detail.status, 200);
        const actions = detail.body.data.allowedActions;
        assert.deepEqual(actions, {
            canView: true,
            canCreate: actor !== "viewer",
            canEdit: actor !== "viewer",
            canChangeStatus: actor !== "viewer",
            canArchive: actor !== "viewer",
            canUnarchive: false,
            canTrash: ["owner", "admin"].includes(actor),
            canRestore: false,
            canPermanentlyDelete: false,
        });
        const list = await request("GET", `/workspace/${ws._id}`, actor);
        assert.deepEqual(list.body.data[0].allowedActions, actions);
        assert.equal(list.body.meta.allowedActions.canCreate, actions.canCreate);
    }
    const archived = await request("PUT", `/status/${f._id}`, "editor", { status: "ARCHIVED" });
    assert.equal(archived.body.data.allowedActions.canArchive, false);
    assert.equal(archived.body.data.allowedActions.canUnarchive, true);
    assert.equal((await request("PUT", `/trash/${f._id}`, "admin")).status, 200);
    const trashed = await request("GET", `/get/${f._id}`, "admin");
    assert.equal(trashed.body.data.allowedActions.canEdit, false);
    assert.equal(trashed.body.data.allowedActions.canTrash, false);
    assert.equal(trashed.body.data.allowedActions.canRestore, true);
    assert.equal(trashed.body.data.allowedActions.canPermanentlyDelete, true);
    const restored = await request("PUT", `/restore/${f._id}`, "editor");
    assert.equal(restored.body.data.allowedActions.canEdit, true);
    assert.equal(restored.body.data.allowedActions.canRestore, false);
});

test("action metadata respects default folders, retention, empty lists and role changes", async () => {
    const ws = await fixture();
    for (const actor of ["owner", "editor", "viewer"]) {
        const list = await request("GET", `/workspace/${ws._id}`, actor);
        assert.equal(list.body.data.length, 0);
        assert.equal(list.body.meta.allowedActions.canCreate, actor !== "viewer");
    }
    const def = await folder(ws, "ACTIVE", { isDefault: true });
    const actions = (await service.getWorkspaceFolderById(String(def._id), String(users.owner)))
        .allowedActions;
    assert.equal(actions.canEdit, true);
    assert.equal(actions.canArchive, false);
    assert.equal(actions.canTrash, false);
    const expired = await folder(ws, "DELETED", { purgeAfter: new Date(Date.now() - 1000) });
    const expiredActions = (await service.getWorkspaceFolderById(String(expired._id), String(users.owner)))
        .allowedActions;
    assert.equal(expiredActions.canRestore, false);
    assert.equal(expiredActions.canPermanentlyDelete, true);
    const inactive = await folder(ws, "INACTIVE");
    assert.equal(
        (await service.getWorkspaceFolderById(String(inactive._id), String(users.editor))).allowedActions
            .canArchive,
        true,
    );
    assert.equal(
        (await request("PUT", `/status/${inactive._id}`, "editor", { status: "ARCHIVED" })).status,
        200,
    );
    await WorkspaceMemberModel.updateOne(
        { workspaceId: ws._id, userId: users.editor },
        { roleId: roles.WORKSPACE_VIEWER },
    );
    const changed = await request("GET", `/get/${def._id}`, "editor");
    assert.equal(changed.body.data.allowedActions.canEdit, false);
    assert.equal((await request("PUT", `/update/${def._id}`, "editor", { name: "Denied" })).status, 403);
});
for (const [method, path, body, status, allowed] of operations) {
    test(`${path}: owner, admin, editor, viewer and invalid memberships`, async () => {
        const ws = await fixture();
        for (const actor of [
            "owner",
            "admin",
            "editor",
            "viewer",
            "stranger",
            "removed",
            "inactive",
            "empty",
            "own",
            "foreign",
        ]) {
            const f = await folder(ws, status);
            const result = await request(method, `/${path}/${f._id}`, actor, body);
            assert.equal(
                result.status,
                allowed.includes(actor) ? 200 : 403,
                `${actor}: ${JSON.stringify(result)}`,
            );
        }
    });
}

test("all list aliases enforce folder read and workspace state without a workspace filter", async () => {
    const ws = await fixture();
    const f = await folder(ws);
    for (const state of ["INACTIVE", "SUSPENDED", "TRASHED", "DELETED"]) {
        const unavailable = await fixture(state);
        await folder(unavailable);
    }
    for (const [method, path] of [
        ["POST", "/getall"],
        ["GET", "/getall"],
        ["GET", "/"],
        ["GET", "/my"],
    ]) {
        for (const actor of [
            "owner",
            "admin",
            "editor",
            "viewer",
            "stranger",
            "empty",
            "foreign",
            "removed",
            "inactive",
            "own",
        ]) {
            const result = await request(method, path, actor, method === "POST" ? { limit: 100 } : undefined);
            assert.equal(result.status, 200, JSON.stringify(result));
            if (["stranger", "empty", "foreign", "removed", "inactive", "own"].includes(actor))
                assert.equal(result.body.meta.total, 0);
            for (const row of result.body.data) {
                const parent = await WorkspaceModel.findById(row.workspaceId);
                assert.ok(["ACTIVE", "ARCHIVED"].includes(parent.status));
            }
        }
    }
    const result = await request("GET", `/workspace/${ws._id}`, "viewer");
    assert.equal(result.body.data[0].id, String(f._id));
    assert.equal(result.body.meta.total, 1);
});

test("folder READ and workspace READ are both required; OWN does not invent folder ownership", async () => {
    const ws = await fixture();
    await folder(ws);
    for (const codes of [["WORKSPACE_READ"], ["FOLDERS_READ"]]) {
        const role = await RoleModel.create({
            name: new Types.ObjectId().toString(),
            displayName: "Restricted",
            code: new Types.ObjectId().toString(),
            scope: "WORKSPACE",
            isSystem: true,
            permissions: codes.map((code) => permissionIds[code]),
        });
        await WorkspaceMemberModel.updateOne(
            { workspaceId: ws._id, userId: users.viewer },
            { roleId: role._id },
        );
        assert.equal((await request("GET", `/workspace/${ws._id}`, "viewer")).status, 403);
        const list = await service.getWorkspaceFolders(String(users.viewer));
        assert.ok(!list.data.some((row) => row.workspaceId === String(ws._id)));
    }
    const ownRead = await PermissionModel.create({
        name: "folders_read_own",
        displayName: "Read own folders",
        code: "FOLDERS_READ_OWN",
        module: "FOLDERS",
        action: "READ",
        access: "OWN",
        isActive: true,
    });
    const ownRole = await RoleModel.create({
        name: "folder-own",
        displayName: "Folder own",
        code: "FOLDER_OWN",
        scope: "WORKSPACE",
        isSystem: true,
        permissions: [permissionIds.WORKSPACE_READ, ownRead._id],
    });
    await WorkspaceMemberModel.updateOne(
        { workspaceId: ws._id, userId: users.viewer },
        { roleId: ownRole._id },
    );
    const created = await folder(ws, "ACTIVE", { createdBy: users.viewer });
    assert.equal((await request("GET", `/get/${created._id}`, "viewer")).status, 403);
    assert.ok(
        !(await service.getWorkspaceFolders(String(users.viewer))).data.some(
            (row) => row.workspaceId === String(ws._id),
        ),
    );
});

test("inactive, suspended and trashed workspaces reject all folder operations including owners", async () => {
    for (const state of ["INACTIVE", "SUSPENDED", "TRASHED", "DELETED"]) {
        const ws = await fixture(state);
        const expected = ["INACTIVE", "SUSPENDED"].includes(state) ? 403 : 400;
        assert.equal(
            (await request("POST", "/create", "owner", { workspaceId: String(ws._id), name: "No" })).status,
            expected,
        );
        for (const [method, path, body, status] of operations) {
            const f = await folder(ws, status);
            assert.equal((await request(method, `/${path}/${f._id}`, "owner", body)).status, expected);
        }
        assert.equal((await request("GET", `/workspace/${ws._id}`, "owner")).status, expected);
    }
});

test("mismatched workspace hints and authorization contexts cannot authorize another folder", async () => {
    const ws = await fixture();
    const f = await folder(ws);
    const other = await WorkspaceModel.create({
        name: "Other",
        slug: new Types.ObjectId().toString(),
        ownerId: users.stranger,
    });
    for (const [method, path, body] of operations) {
        assert.equal(
            (await request(method, `/${path}/${f._id}?workspaceId=${other._id}`, "stranger", body)).status,
            400,
        );
    }
    assert.equal((await request("GET", `/workspace/${ws._id}?workspaceId=${other._id}`)).status, 400);
    const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
        String(users.stranger),
        String(other._id),
    );
    await assert.rejects(
        service.updateWorkspaceFolder(
            String(f._id),
            { name: "Attack" },
            String(users.stranger),
            undefined,
            auth,
        ),
        { statusCode: 403 },
    );
    await assert.rejects(service.getWorkspaceFolderById(String(f._id), undefined), { statusCode: 401 });
    assert.equal((await request("GET", "/workspace/bad")).status, 400);
});

test("list filters, literal search, counts, stable ordering and summaries", async () => {
    const ws = await fixture();
    const first = await folder(ws, "ACTIVE", { name: "A [literal]", position: 5 });
    const second = await folder(ws, "ACTIVE", { name: "B [literal]", position: 5 });
    await folder(ws, "ARCHIVED", { name: "Archived" });
    await folder(ws, "INACTIVE");
    await folder(ws, "DELETED");
    const result = await request("POST", "/getall", "viewer", {
        workspaceId: String(ws._id),
        page: 1,
        limit: 1,
        search: "[literal]",
        sortBy: "name",
        sortOrder: "desc",
    });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.body.data[0].id, String(second._id));
    assert.deepEqual(result.body.meta.counts, { all: 2, active: 2, inactive: 0, archived: 0, deleted: 0 });
    assert.equal(result.body.meta.totalPages, 2);
    const all = await request("GET", `/workspace/${ws._id}?status=ALL&limit=100`);
    assert.equal(all.body.meta.total, 4);
    assert.equal(all.body.meta.counts.deleted, 1);
    const trash = await request("GET", `/workspace/${ws._id}?status=DELETED`);
    assert.equal(trash.body.meta.total, 1);
    const summaries = await new WorkspaceFolderRepository().getActiveFolderSummariesByWorkspaceIds([
        String(ws._id),
    ]);
    assert.deepEqual(summaries.get(String(ws._id)), [
        { id: String(first._id), name: first.name },
        { id: String(second._id), name: second.name },
    ]);
    assert.deepEqual(result.body.data[0].summary, {
        stickyNoteCount: 0,
        stickyNotesCount: 0,
        total: 0,
        active: 0,
        archived: 0,
    });
    await StickyNoteModel.collection.insertMany([
        { workspaceId: ws._id, workspaceFolderId: first._id, title: "Note 1", status: "ACTIVE" },
        { workspaceId: ws._id, workspaceFolderId: first._id, title: "Note 2", status: "ACTIVE" },
        { workspaceId: ws._id, workspaceFolderId: first._id, title: "Note 3", status: "ARCHIVED" },
        { workspaceId: ws._id, workspaceFolderId: first._id, title: "Note 4", status: "TRASHED" },
    ]);
    const withNotes = await request("GET", `/workspace/${ws._id}?limit=100`);
    const firstFolder = withNotes.body.data.find((f) => f.id === String(first._id));
    assert.deepEqual(firstFolder.summary, {
        stickyNoteCount: 2,
        stickyNotesCount: 2,
        total: 3,
        active: 2,
        archived: 1,
    });
    const singleFolder = await request("GET", `/get/${first._id}`);
    assert.deepEqual(singleFolder.body.data.summary, {
        stickyNoteCount: 2,
        stickyNotesCount: 2,
        total: 3,
        active: 2,
        archived: 1,
    });
    await StickyNoteModel.deleteMany({ workspaceFolderId: first._id });
    for (const body of [
        { page: true },
        { page: [] },
        { page: 1.5 },
        { limit: -1 },
        { sortBy: "$where" },
        { page: Number.MAX_SAFE_INTEGER },
        { deletedBy: String(users.owner) },
    ]) {
        assert.equal((await request("POST", "/getall", "owner", body)).status, 400);
    }
});

test("trash and restore preserve notes, columns, ordering and metadata; expiry is enforced", async () => {
    const ws = await fixture();
    const f = await folder(ws, "ARCHIVED", { position: 7 });
    const note = await StickyNoteModel.collection.insertOne({
        workspaceId: ws._id,
        workspaceFolderId: f._id,
        title: "Keep",
        status: "ACTIVE",
    });
    const column = await StickyNoteColumnModel.collection.insertOne({
        workspaceId: ws._id,
        workspaceFolderId: f._id,
        name: "Keep",
    });
    assert.equal((await request("PUT", `/trash/${f._id}`)).status, 200);
    const deleted = await WorkspaceFolderModel.findById(f._id).lean();
    assert.equal(deleted.status, "DELETED");
    assert.equal(String(deleted.deletedBy), String(users.owner));
    assert.equal(deleted.purgeAfter - deleted.deletedAt, 60 * 86400000);
    assert.equal((await request("DELETE", `/delete/${f._id}`)).status, 400);
    assert.equal((await request("PUT", `/status/${f._id}`, "owner", { status: "ACTIVE" })).status, 404);
    assert.equal((await request("DELETE", `/permanent/${f._id}`)).status, 409);
    assert.equal((await request("PUT", `/restore/${f._id}`)).status, 200);
    const restored = await WorkspaceFolderModel.findById(f._id).lean();
    assert.equal(restored.position, 7);
    assert.equal(restored.deletedAt, null);
    assert.equal(restored.purgeAfter, null);
    assert.equal(String((await StickyNoteModel.findById(note.insertedId)).workspaceFolderId), String(f._id));
    assert.ok(await StickyNoteColumnModel.exists({ _id: column.insertedId }));
    await request("PUT", `/trash/${f._id}`);
    await WorkspaceFolderModel.updateOne({ _id: f._id }, { purgeAfter: new Date(0) });
    assert.equal((await request("PUT", `/restore/${f._id}`)).status, 410);
    const legacy = await folder(ws, "DELETED");
    assert.equal((await request("PUT", `/restore/${legacy._id}`)).status, 200);
});

test("permanent deletion requires trash, blocks cross-workspace dependencies and is safe to retry", async () => {
    const ws = await fixture();
    const f = await folder(ws);
    assert.equal((await request("DELETE", `/permanent/${f._id}`)).status, 400);
    await request("PUT", `/trash/${f._id}`);
    const note = await StickyNoteModel.collection.insertOne({
        workspaceId: new Types.ObjectId(),
        workspaceFolderId: f._id,
        status: "DELETED",
    });
    assert.equal((await request("DELETE", `/permanent/${f._id}`)).status, 409);
    await StickyNoteModel.deleteOne({ _id: note.insertedId });
    assert.equal((await request("DELETE", `/permanent/${f._id}`)).status, 200);
    assert.equal((await request("DELETE", `/permanent/${f._id}`)).status, 404);
    assert.equal(
        await AuditLogModel.countDocuments({ resourceId: String(f._id), "metadata.permanent": true }),
        1,
    );
});

test("audit actor, actual change tracking, no-op updates and mutation rollback", async () => {
    const ws = await fixture();
    const f = await folder(ws);
    await request("PUT", `/update/${f._id}`, "editor", { name: "Edited" });
    const log = await AuditLogModel.findOne({ resourceId: String(f._id), action: "UPDATE" }).lean();
    assert.equal(String(log.actorId), String(users.editor));
    assert.equal(log.changes[0].oldValue, "Folder");
    await request("PUT", `/update/${f._id}`, "editor", { name: "Edited" });
    assert.equal(await AuditLogModel.countDocuments({ resourceId: String(f._id), action: "UPDATE" }), 1);
    for (const [method, path, body, status] of operations.filter((op) => op[0] !== "GET")) {
        const target = await folder(ws, status);
        const beforeState = await WorkspaceFolderModel.findById(target._id).lean();
        const auditMethod = path === "permanent" ? "logMany" : "log";
        const auditMock = mock.method(AuditLogService.prototype, auditMethod, async () => {
            throw new Error("Audit unavailable");
        });
        try {
            assert.equal((await request(method, `/${path}/${target._id}`, "owner", body)).status, 500);
        } finally {
            auditMock.mock.restore();
        }
        assert.deepEqual(await WorkspaceFolderModel.findById(target._id).lean(), beforeState, path);
    }
    const auditMock = mock.method(AuditLogService.prototype, "log", async () => {
        throw new Error("Audit unavailable");
    });
    try {
        assert.equal(
            (await request("POST", "/create", "owner", { workspaceId: String(ws._id), name: "Rollback" }))
                .status,
            500,
        );
    } finally {
        auditMock.mock.restore();
    }
    assert.equal(await WorkspaceFolderModel.countDocuments({ workspaceId: ws._id, name: "Rollback" }), 0);
});
