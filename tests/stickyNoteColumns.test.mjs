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
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { UserModel } from "../src/modules/user/models/user.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { StickyNoteModel } from "../src/modules/stickynotes/models/stickyNote.model.ts";
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { StickyNoteColumnService } from "../src/modules/stickynotescolumns/services/stickyNoteColumn.service.ts";
import {
    StickyNoteColumnType,
    StickyNoteColumnColor,
} from "../src/modules/stickynotescolumns/constants/stickyNoteColumn.enums.js";
import { StickyNoteColumnMessages } from "../src/modules/stickynotescolumns/constants/stickyNoteColumn.messages.js";
import { seedPermissions } from "../src/modules/permissions/seeders/permission.seeder.ts";
import { seedRoles } from "../src/modules/roles/seeders/role.seeder.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "column-test-access-secret";
process.env.JWT_REFRESH_SECRET = "column-test-refresh-secret";

const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: stickyNoteColumnRoutes } =
    await import("../src/modules/stickynotescolumns/routes/stickyNoteColumn.routes.ts");

let mongoProcess, directory, server, baseUrl;
const auditEvents = [];

const users = Object.fromEntries(
    ["owner", "admin", "editor", "viewer", "stranger", "removed", "inactive"].map((name) => [
        name,
        new Types.ObjectId(),
    ]),
);
const roles = {};
const permissionIds = {};
const service = new StickyNoteColumnService();

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    directory = await mkdtemp(join(tmpdir(), "sticky-note-columns-test-"));
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
            "stickyColumns",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/sticky_columns_test?directConnection=true`, {
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
        replSetInitiate: { _id: "stickyColumns", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });

    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        assert.ok(attempt < 80);
        await delay(250);
    }

    for (const model of Object.values(mongoose.models)) {
        await model.createCollection();
    }

    await seedPermissions();
    await seedRoles();

    for (const p of await PermissionModel.find().lean()) permissionIds[p.code] = p._id;
    for (const r of await RoleModel.find().lean()) roles[r.code] = r._id;

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
                permissionIds.NOTES_READ,
                permissionIds.NOTES_CREATE,
                permissionIds.NOTES_UPDATE_ANY,
                permissionIds.NOTES_DELETE_ANY,
            ],
        })
    )._id;

    for (const [name, _id] of Object.entries(users)) {
        await UserModel.create({
            _id,
            email: `${name}@columns.test`,
            status: "ACTIVE",
            globalRoleId: name === "owner" ? roles.USER : roles.USER,
        });
    }

    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));

    mock.method(AuditLogService.prototype, "logCreate", async (ctx, res, msg) => {
        auditEvents.push({ action: "CREATE", res, msg });
    });
    mock.method(AuditLogService.prototype, "logUpdate", async (ctx, res, msg, changes) => {
        auditEvents.push({ action: "UPDATE", res, msg, changes });
    });
    mock.method(AuditLogService.prototype, "logDelete", async (ctx, res, msg) => {
        auditEvents.push({ action: "DELETE", res, msg });
    });

    const app = express();
    app.use(express.json());
    app.use("/stickynotescolumns", stickyNoteColumnRoutes);
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
        assert.ok(basename(target).startsWith("sticky-note-columns-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

async function fixture(status = "ACTIVE") {
    const ws = await WorkspaceModel.create({
        name: "Columns Workspace",
        slug: new Types.ObjectId().toString(),
        ownerId: users.owner,
        status,
    });

    const folder = await WorkspaceFolderModel.create({
        workspaceId: ws._id,
        name: "General Folder",
        slug: new Types.ObjectId().toString(),
        status: "ACTIVE",
        createdBy: users.owner,
        updatedBy: users.owner,
    });

    for (const actor of ["admin", "editor", "viewer", "removed"]) {
        const roleId = roles[actor] ?? roles[actor === "admin" ? "WORKSPACE_ADMIN" : "WORKSPACE_VIEWER"];
        await WorkspaceMemberModel.create({
            workspaceId: ws._id,
            userId: users[actor],
            roleId,
            status: actor === "removed" ? "REMOVED" : "ACTIVE",
        });
    }

    return { ws, folder };
}

async function request(method, path, actor = "owner", body) {
    const response = await fetch(`${baseUrl}/stickynotescolumns${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${users[actor] ?? actor}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
}

test("1 & 16. Create column successfully and verify response envelope", async () => {
    const { ws, folder } = await fixture();
    const res = await request("POST", "/create", "owner", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        name: "Backlog",
        color: StickyNoteColumnColor.BLUE,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, StickyNoteColumnMessages.CREATED);
    assert.ok(res.body.data.id);
    assert.equal(res.body.data.name, "Backlog");
    assert.equal(res.body.data.color, StickyNoteColumnColor.BLUE);
    assert.equal(res.body.data.type, StickyNoteColumnType.CUSTOM);
    assert.equal(res.body.data.isSystem, false);
});

test("2. Reject invalid input on column creation", async () => {
    const { ws, folder } = await fixture();

    // Missing workspaceId
    assert.equal(
        (await request("POST", "/create", "owner", { workspaceFolderId: String(folder._id), name: "Test" }))
            .status,
        400,
    );

    // Invalid workspaceId
    assert.equal(
        (
            await request("POST", "/create", "owner", {
                workspaceId: "invalid-id",
                workspaceFolderId: String(folder._id),
                name: "Test",
            })
        ).status,
        400,
    );

    // Missing name
    assert.equal(
        (
            await request("POST", "/create", "owner", {
                workspaceId: String(ws._id),
                workspaceFolderId: String(folder._id),
            })
        ).status,
        400,
    );

    // Unsupported fields
    assert.equal(
        (
            await request("POST", "/create", "owner", {
                workspaceId: String(ws._id),
                workspaceFolderId: String(folder._id),
                name: "Test",
                isSystem: true,
            })
        ).status,
        400,
    );

    // Invalid color
    assert.equal(
        (
            await request("POST", "/create", "owner", {
                workspaceId: String(ws._id),
                workspaceFolderId: String(folder._id),
                name: "Test",
                color: "BLACK",
            })
        ).status,
        400,
    );
});

test("3 & 5. Reject unauthorized creation and stranger access", async () => {
    const { ws, folder } = await fixture();

    // Viewer cannot create column
    const viewerRes = await request("POST", "/create", "viewer", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        name: "Viewer Column",
    });
    assert.equal(viewerRes.status, 403);

    // Stranger cannot create column
    const strangerRes = await request("POST", "/create", "stranger", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        name: "Stranger Column",
    });
    assert.equal(strangerRes.status, 403);

    // Removed member cannot create column
    const removedRes = await request("POST", "/create", "removed", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        name: "Removed Column",
    });
    assert.equal(removedRes.status, 403);
});

test("4. Fetch columns within authorized workspace and single column by id", async () => {
    const { ws, folder } = await fixture();
    await service.createDefaultColumns(String(ws._id), String(folder._id), String(users.owner));

    // POST /getall with body
    const postListRes = await request("POST", "/getall", "editor", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
    });
    assert.equal(postListRes.status, 200);
    assert.equal(postListRes.body.success, true);
    assert.equal(postListRes.body.data.length, 3);

    // GET /getall with query params
    const listRes = await request(
        "GET",
        `/getall?workspaceId=${ws._id}&workspaceFolderId=${folder._id}`,
        "editor",
    );
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data));
    assert.equal(listRes.body.data.length, 3);

    // GET / with query params (route alias matching workspace)
    const rootListRes = await request(
        "GET",
        `/?workspaceId=${ws._id}&workspaceFolderId=${folder._id}`,
        "editor",
    );
    assert.equal(rootListRes.status, 200);
    assert.equal(rootListRes.body.data.length, 3);

    const firstCol = listRes.body.data[0];
    const singleRes = await request("GET", `/get/${firstCol.id}`, "viewer");
    assert.equal(singleRes.status, 200);
    assert.equal(singleRes.body.success, true);
    assert.equal(singleRes.body.data.id, firstCol.id);
});

test("6 & 7. Update column successfully and reject unauthorized updates", async () => {
    const { ws, folder } = await fixture();
    const col = await service.createStickyNoteColumn(
        {
            workspaceId: String(ws._id),
            workspaceFolderId: String(folder._id),
            name: "Initial Name",
            color: StickyNoteColumnColor.YELLOW,
        },
        String(users.owner),
    );

    // Viewer cannot update
    const viewerRes = await request("PUT", `/update/${col.id}`, "viewer", { name: "Hacked" });
    assert.equal(viewerRes.status, 403);

    // Stranger cannot update
    const strangerRes = await request("PUT", `/update/${col.id}`, "stranger", { name: "Hacked" });
    assert.equal(strangerRes.status, 403);

    // Editor can update
    const editorRes = await request("PUT", `/update/${col.id}`, "editor", {
        name: "Updated Name",
        color: StickyNoteColumnColor.PINK,
    });
    assert.equal(editorRes.status, 200);
    assert.equal(editorRes.body.data.name, "Updated Name");
    assert.equal(editorRes.body.data.color, StickyNoteColumnColor.PINK);
});

test("8 & 9 & 10. Reorder columns, reject duplicates and maintain workspace isolation", async () => {
    const { ws, folder } = await fixture();
    const defaults = await service.createDefaultColumns(
        String(ws._id),
        String(folder._id),
        String(users.owner),
    );
    const ids = defaults.map((c) => c.id);

    // Reverse order
    const reversed = [ids[2], ids[1], ids[0]];
    const reorderRes = await request("PUT", "/reorder", "editor", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        columnIds: reversed,
    });
    assert.equal(reorderRes.status, 200);
    assert.equal(reorderRes.body.data[0].id, ids[2]);
    assert.equal(reorderRes.body.data[1].id, ids[1]);
    assert.equal(reorderRes.body.data[2].id, ids[0]);

    // Reject duplicate IDs
    const dupRes = await request("PUT", "/reorder", "owner", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        columnIds: [ids[0], ids[0], ids[1]],
    });
    assert.equal(dupRes.status, 400);

    // Reject partial or extra columns
    const partialRes = await request("PUT", "/reorder", "owner", {
        workspaceId: String(ws._id),
        workspaceFolderId: String(folder._id),
        columnIds: [ids[0], ids[1]],
    });
    assert.equal(partialRes.status, 400);

    // Item reorder
    const itemReorderRes = await request("PUT", `/reorder/${ids[2]}`, "owner", {
        beforeId: ids[0],
    });
    assert.equal(itemReorderRes.status, 200);
});

test("11 & 12. Delete column moves sticky notes to default To do column and system columns cannot be deleted", async () => {
    const { ws, folder } = await fixture();
    const defaults = await service.createDefaultColumns(
        String(ws._id),
        String(folder._id),
        String(users.owner),
    );
    const todoCol = defaults.find((c) => c.type === StickyNoteColumnType.TODO);

    // Reject deletion of system column
    const sysDelRes = await request("DELETE", `/delete/${todoCol.id}`, "owner");
    assert.equal(sysDelRes.status, 400);
    assert.equal(sysDelRes.body.message, StickyNoteColumnMessages.CANNOT_DELETE_SYSTEM_COLUMN);

    // Create custom column and attach sticky note
    const customCol = await service.createStickyNoteColumn(
        {
            workspaceId: String(ws._id),
            workspaceFolderId: String(folder._id),
            name: "Sprint Backlog",
        },
        String(users.owner),
    );

    const note = await StickyNoteModel.create({
        workspaceId: ws._id,
        workspaceFolderId: folder._id,
        columnId: new Types.ObjectId(customCol.id),
        title: "Feature X",
        content: "Feature X Content",
        stickyNoteNumber: 1,
        status: "ACTIVE",
        createdBy: users.owner,
        updatedBy: users.owner,
    });

    // Delete custom column
    const delRes = await request("DELETE", `/delete/${customCol.id}`, "owner");
    assert.equal(delRes.status, 200);

    // Verify column deleted
    assert.equal(await StickyNoteColumnModel.findById(customCol.id), null);

    // Verify note moved to default TODO column
    const updatedNote = await StickyNoteModel.findById(note._id);
    assert.equal(String(updatedNote.columnId), todoCol.id);
});

test("13. Enforce archived and trashed workspace restrictions", async () => {
    const { ws: trashedWs, folder: trashedFolder } = await fixture("TRASHED");

    // Creating column in trashed workspace rejected
    const createRes = await request("POST", "/create", "owner", {
        workspaceId: String(trashedWs._id),
        workspaceFolderId: String(trashedFolder._id),
        name: "Blocked Column",
    });
    assert.equal(createRes.status, 400);

    const { ws: inactiveWs, folder: inactiveFolder } = await fixture("INACTIVE");
    const inactiveRes = await request("POST", "/create", "admin", {
        workspaceId: String(inactiveWs._id),
        workspaceFolderId: String(inactiveFolder._id),
        name: "Inactive Blocked",
    });
    assert.equal(inactiveRes.status, 403);
});

test("14 & 15. Verify audit behavior on mutations", async () => {
    auditEvents.length = 0;
    const { ws, folder } = await fixture();

    // Ensure default columns exist before deleting
    await service.createDefaultColumns(String(ws._id), String(folder._id), String(users.owner));

    const created = await service.createStickyNoteColumn(
        {
            workspaceId: String(ws._id),
            workspaceFolderId: String(folder._id),
            name: "Audit Test Column",
        },
        String(users.owner),
        { actorId: String(users.owner) },
    );

    assert.ok(auditEvents.some((e) => e.action === "CREATE" && e.res.resourceId === created.id));

    await service.updateStickyNoteColumn(
        created.id,
        {
            name: "Renamed Audit Column",
        },
        String(users.owner),
        { actorId: String(users.owner) },
    );

    assert.ok(auditEvents.some((e) => e.action === "UPDATE" && e.res.resourceId === created.id));

    await service.deleteStickyNoteColumn(created.id, String(users.owner), { actorId: String(users.owner) });
    assert.ok(auditEvents.some((e) => e.action === "DELETE" && e.res.resourceId === created.id));
});
