import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
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
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { WorkspaceRepository } from "../src/modules/workspace/repositories/workspace.repository.ts";
import { WorkspaceService } from "../src/modules/workspace/services/workspace.service.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "workspace-test-access-secret";
process.env.JWT_REFRESH_SECRET = "workspace-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: workspaceRoutes } = await import("../src/modules/workspace/routes/workspace.routes.ts");

let mongoProcess, mongoDirectory, httpServer, baseUrl;
const ownerId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const strangerId = new Types.ObjectId();
const roleId = new Types.ObjectId();

// Workspaces
const wsWithFolders = new Types.ObjectId();
const wsNoFolders = new Types.ObjectId();
const wsWithDeletedFoldersOnly = new Types.ObjectId();
const wsArchivedWithFolders = new Types.ObjectId();
const wsPersonalWithFolders = new Types.ObjectId();
const wsMemberShared = new Types.ObjectId();

// Folders
const folder1 = new Types.ObjectId();
const folder2 = new Types.ObjectId();
const deletedFolder = new Types.ObjectId();
const personalFolder = new Types.ObjectId();
const memberSharedFolder = new Types.ObjectId();
const archivedWsFolder = new Types.ObjectId();

async function request(path, body, userId = ownerId) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${userId}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
}

before(async () => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    mongoDirectory = await mkdtemp(join(tmpdir(), "workspace-dropdown-test-"));
    mongoProcess = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            mongoDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/workspace_dropdown_test`, {
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
        WorkspaceModel.createIndexes(),
        WorkspaceMemberModel.createIndexes(),
        WorkspaceFolderModel.createIndexes(),
    ]);

    const read = await PermissionModel.create({
        name: "workspace_read",
        displayName: "Read",
        code: "WORKSPACE_READ",
        module: "WORKSPACE",
        action: "READ",
        access: "GENERAL",
        isActive: true,
    });

    await RoleModel.create({
        _id: roleId,
        name: "viewer",
        displayName: "Viewer",
        code: "WORKSPACE_VIEWER",
        scope: "WORKSPACE",
        isSystem: true,
        isActive: true,
        permissions: [read._id],
    });

    // Seed Workspaces
    await WorkspaceModel.collection.insertMany([
        {
            _id: wsPersonalWithFolders,
            name: "My Personal Space",
            slug: "my-personal-space",
            ownerId,
            status: "ACTIVE",
            visibility: "PRIVATE",
            isPersonal: true,
            createdAt: new Date("2026-01-01"),
            updatedAt: new Date("2026-01-01"),
        },
        {
            _id: wsWithFolders,
            name: "Alpha Project",
            slug: "alpha-project",
            ownerId,
            status: "ACTIVE",
            visibility: "PRIVATE",
            isPersonal: false,
            createdAt: new Date("2026-01-02"),
            updatedAt: new Date("2026-01-02"),
        },
        {
            _id: wsNoFolders,
            name: "Beta Empty Space",
            slug: "beta-empty-space",
            ownerId,
            status: "ACTIVE",
            visibility: "PRIVATE",
            isPersonal: false,
            createdAt: new Date("2026-01-03"),
            updatedAt: new Date("2026-01-03"),
        },
        {
            _id: wsWithDeletedFoldersOnly,
            name: "Gamma Space All Folders Trashed",
            slug: "gamma-space-trashed",
            ownerId,
            status: "ACTIVE",
            visibility: "PRIVATE",
            isPersonal: false,
            createdAt: new Date("2026-01-04"),
            updatedAt: new Date("2026-01-04"),
        },
        {
            _id: wsArchivedWithFolders,
            name: "Delta Archived Space",
            slug: "delta-archived-space",
            ownerId,
            status: "ARCHIVED",
            visibility: "PRIVATE",
            isPersonal: false,
            createdAt: new Date("2026-01-05"),
            updatedAt: new Date("2026-01-05"),
        },
        {
            _id: wsMemberShared,
            name: "Zeta Team Space",
            slug: "zeta-team-space",
            ownerId: strangerId,
            status: "ACTIVE",
            visibility: "PRIVATE",
            isPersonal: false,
            createdAt: new Date("2026-01-06"),
            updatedAt: new Date("2026-01-06"),
        },
    ]);

    // Seed Memberships
    await WorkspaceMemberModel.collection.insertMany([
        {
            _id: new Types.ObjectId(),
            workspaceId: wsMemberShared,
            userId: memberId,
            roleId,
            status: "ACTIVE",
            joinedAt: new Date("2026-01-01"),
        },
    ]);

    // Seed Folders
    await WorkspaceFolderModel.collection.insertMany([
        {
            _id: personalFolder,
            workspaceId: wsPersonalWithFolders,
            name: "Personal Notes",
            slug: "personal-notes",
            position: 0,
            isDefault: true,
            status: "ACTIVE",
        },
        {
            _id: folder1,
            workspaceId: wsWithFolders,
            name: "Default Ideas",
            slug: "default-ideas",
            position: 0,
            isDefault: true,
            status: "ACTIVE",
        },
        {
            _id: folder2,
            workspaceId: wsWithFolders,
            name: "Sprint 1",
            slug: "sprint-1",
            position: 1,
            isDefault: false,
            status: "ACTIVE",
        },
        {
            _id: deletedFolder,
            workspaceId: wsWithDeletedFoldersOnly,
            name: "Old Deleted Folder",
            slug: "old-deleted-folder",
            position: 0,
            isDefault: false,
            status: "DELETED",
        },
        {
            _id: archivedWsFolder,
            workspaceId: wsArchivedWithFolders,
            name: "Archived Notes",
            slug: "archived-notes",
            position: 0,
            isDefault: true,
            status: "ACTIVE",
        },
        {
            _id: memberSharedFolder,
            workspaceId: wsMemberShared,
            name: "Team Tasks",
            slug: "team-tasks",
            position: 0,
            isDefault: true,
            status: "ACTIVE",
        },
    ]);

    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));

    const app = express();
    app.use(express.json());
    app.use("/api/v1/workspaces", workspaceRoutes);
    app.use(errorMiddleware);
    httpServer = app.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/v1/workspaces`;
});

after(async () => {
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
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
        assert.ok(basename(target).startsWith("workspace-dropdown-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("GET /dropdown returns only workspaces that have at least one active folder", async () => {
    const res = await request("/dropdown", undefined, ownerId);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    // Expected workspaces: My Personal Space (1 folder) and Alpha Project (2 folders)
    // Beta Empty Space (0 folders) should be omitted
    // Gamma Space (only deleted folder) should be omitted
    // Delta Archived Space (archived workspace) should be omitted
    // Zeta Team Space (belongs to stranger) should be omitted
    const workspaceNames = res.body.data.map((w) => w.name);
    assert.deepEqual(workspaceNames, ["My Personal Space", "Alpha Project"]);
    assert.equal(res.body.data.length, 2);
});

test("Dropdown response is lightweight: provides only name and id for workspace and its folders", async () => {
    const res = await request("/dropdown", undefined, ownerId);
    assert.equal(res.status, 200);

    for (const ws of res.body.data) {
        // Workspace must have strictly keys: id, name, folders
        const wsKeys = Object.keys(ws).sort();
        assert.deepEqual(wsKeys, ["folders", "id", "name"]);
        assert.equal(typeof ws.id, "string");
        assert.equal(typeof ws.name, "string");
        assert.ok(Array.isArray(ws.folders));
        assert.ok(ws.folders.length >= 1, "Workspace must have at least one folder");

        for (const folder of ws.folders) {
            // Folder must have strictly keys: id, name
            const folderKeys = Object.keys(folder).sort();
            assert.deepEqual(folderKeys, ["id", "name"]);
            assert.equal(typeof folder.id, "string");
            assert.equal(typeof folder.name, "string");
        }
    }

    // Verify folder details for Alpha Project
    const alpha = res.body.data.find((w) => w.name === "Alpha Project");
    assert.ok(alpha);
    assert.equal(alpha.folders.length, 2);
    assert.deepEqual(
        alpha.folders.map((f) => f.name),
        ["Default Ideas", "Sprint 1"],
    );
    assert.equal(alpha.folders[0].id, folder1.toString());
    assert.equal(alpha.folders[1].id, folder2.toString());
});

test("Route aliases (/folders-dropdown, /dropdown/folders, and POST) return identical results", async () => {
    const getDropdown = await request("/dropdown", undefined, ownerId);
    const getFoldersDropdown = await request("/folders-dropdown", undefined, ownerId);
    const getDropdownFolders = await request("/dropdown/folders", undefined, ownerId);
    const postDropdown = await request("/dropdown", {}, ownerId);

    assert.deepEqual(getDropdown.body, getFoldersDropdown.body);
    assert.deepEqual(getDropdown.body, getDropdownFolders.body);
    assert.deepEqual(getDropdown.body, postDropdown.body);
});

test("Active member can see shared team workspace and its folders in dropdown", async () => {
    const res = await request("/dropdown", undefined, memberId);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, "Zeta Team Space");
    assert.equal(res.body.data[0].folders.length, 1);
    assert.equal(res.body.data[0].folders[0].name, "Team Tasks");
    assert.equal(res.body.data[0].folders[0].id, memberSharedFolder.toString());
});

test("Stranger with no workspaces or memberships gets empty data array", async () => {
    const res = await request("/dropdown", undefined, strangerId);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // stranger owns Zeta Team Space which has 1 folder
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, "Zeta Team Space");

    // Random user with no workspaces
    const randomUser = new Types.ObjectId();
    const resEmpty = await request("/dropdown", undefined, randomUser);
    assert.equal(resEmpty.status, 200);
    assert.deepEqual(resEmpty.body.data, []);
});

test("Search filter matches workspace name or folder name", async () => {
    // Search workspace name "Alpha"
    const resAlpha = await request("/dropdown?search=Alpha", undefined, ownerId);
    assert.equal(resAlpha.status, 200);
    assert.equal(resAlpha.body.data.length, 1);
    assert.equal(resAlpha.body.data[0].name, "Alpha Project");

    // Search folder name "Sprint"
    const resSprint = await request("/dropdown?search=Sprint", undefined, ownerId);
    assert.equal(resSprint.status, 200);
    assert.equal(resSprint.body.data.length, 1);
    assert.equal(resSprint.body.data[0].name, "Alpha Project");
    assert.equal(resSprint.body.data[0].folders.length, 1);
    assert.equal(resSprint.body.data[0].folders[0].name, "Sprint 1");

    // Search nonexistent
    const resNone = await request("/dropdown?search=NonExistent", undefined, ownerId);
    assert.equal(resNone.status, 200);
    assert.deepEqual(resNone.body.data, []);
});

test("Validation: search exceeding max length returns 400 error", async () => {
    const longSearch = "a".repeat(101);
    const res = await request(`/dropdown?search=${longSearch}`, undefined, ownerId);
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
});

test("Authentication is required and invalid token returns 401", async () => {
    const unauth = await fetch(`${baseUrl}/dropdown`);
    assert.equal(unauth.status, 401);

    const invalidId = await request("/dropdown", undefined, "not-a-valid-id");
    assert.equal(invalidId.status, 401);
});
