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
import { workspaceListSchema } from "../src/modules/workspace/validations/workspaceList.schema.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "workspace-test-access-secret";
process.env.JWT_REFRESH_SECRET = "workspace-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: workspaceRoutes } = await import("../src/modules/workspace/routes/workspace.routes.ts");

let mongoProcess, mongoDirectory, httpServer, baseUrl;
const ownerId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const emptyId = new Types.ObjectId();
const roleId = new Types.ObjectId();
const activeFolderId = new Types.ObjectId();
const repository = new WorkspaceRepository();
const counts = { all: 7, active: 5, archived: 2 };
const names = ["alpha", "Bravo", "charlie", "delta", "Echo", "Literal [x].*", "ALPHA"];
const rows = names.map((name, index) => ({
    _id: new Types.ObjectId(),
    name,
    slug: `workspace-${index}`,
    description: "description-only-token",
    ownerId: index < 4 ? ownerId : otherId,
    createdBy: otherId,
    updatedBy: ownerId,
    status: index === 3 || index === 5 ? "ARCHIVED" : "ACTIVE",
    visibility: "PRIVATE",
    isPersonal: index === 1,
    createdAt: new Date(Date.UTC(2026, 0, index === 6 ? 1 : index + 1)),
    updatedAt: new Date(Date.UTC(2026, 1, index === 6 ? 7 : 7 - index)),
}));

async function list(filters = {}, userId = ownerId) {
    return repository.listAccessible(String(userId), workspaceListSchema.parse(filters));
}

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
    mongoDirectory = await mkdtemp(join(tmpdir(), "workspace-list-test-"));
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/workspace_list_test`, {
                serverSelectionTimeoutMS: 500,
                autoIndex: false,
            });
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }
    await Promise.all([WorkspaceModel.createIndexes(), WorkspaceMemberModel.createIndexes()]);
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
    const excluded = ["DELETED", "INACTIVE", "SUSPENDED", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"].map(
        (status, i) => ({
            ...rows[0],
            _id: new Types.ObjectId(),
            slug: `excluded-${i}`,
            name: `Excluded ${i}`,
            ownerId: i < 3 ? ownerId : otherId,
            createdBy: ownerId,
            status,
        }),
    );
    await WorkspaceModel.collection.insertMany([...rows, ...excluded]);
    await WorkspaceMemberModel.collection.insertMany([
        ...[rows[0], ...rows.slice(4)].map((row) => ({
            _id: new Types.ObjectId(),
            workspaceId: row._id,
            userId: ownerId,
            roleId,
            status: "ACTIVE",
            joinedAt: new Date("2026-01-01"),
        })),
        ...["INVITED", "REMOVED"].map((status, i) => ({
            _id: new Types.ObjectId(),
            workspaceId: excluded[4 + i]._id,
            userId: ownerId,
            roleId,
            status,
        })),
        {
            _id: new Types.ObjectId(),
            workspaceId: excluded[0]._id,
            userId: ownerId,
            roleId,
            status: "ACTIVE",
        },
    ]);
    await WorkspaceFolderModel.collection.insertMany([
        {
            _id: activeFolderId,
            workspaceId: rows[0]._id,
            name: "Ideas",
            position: 0,
            isDefault: true,
            status: "ACTIVE",
        },
        { workspaceId: rows[0]._id, name: "Old", position: 1, isDefault: false, status: "DELETED" },
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
        assert.ok(basename(target).startsWith("workspace-list-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("defaults, owner/member access, exclusions, and no owner/member duplicates", async () => {
    const result = await list();
    assert.deepEqual(result.counts, counts);
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 5, totalPages: 1 });
    assert.deepEqual(
        result.data.map((row) => row.name),
        ["Echo", "charlie", "Bravo", "alpha", "ALPHA"],
    );
    assert.equal(new Set(result.data.map((row) => String(row._id))).size, 5);
});

for (const [status, total] of [
    ["ACTIVE", 5],
    ["ARCHIVED", 2],
    ["ALL", 7],
]) {
    test(`${status} filter has independent tab counts`, async () => {
        const result = await list({ status });
        assert.equal(result.pagination.total, total);
        assert.equal(result.data.length, total);
        assert.deepEqual(result.counts, counts);
        if (status !== "ALL") assert.ok(result.data.every((row) => row.status === status));
    });
}

const orders = {
    RECENTLY_CREATED: [5, 4, 3, 2, 1, 0, 6],
    RECENTLY_UPDATED: [0, 6, 1, 2, 3, 4, 5],
    OLDEST_FIRST: [0, 6, 1, 2, 3, 4, 5],
    NAME_ASC: [0, 6, 1, 2, 3, 4, 5],
    NAME_DESC: [5, 4, 3, 2, 1, 0, 6],
};
for (const [sortBy, indices] of Object.entries(orders)) {
    test(`${sortBy} sorts in MongoDB with stable ties`, async () => {
        const result = await list({ status: "ALL", sortBy });
        assert.deepEqual(
            result.data.map((row) => String(row._id)),
            indices.map((i) => String(rows[i]._id)),
        );
        assert.deepEqual(result.counts, counts);
        const pages = [];
        for (let page = 1; page <= 4; page++) {
            pages.push(...(await list({ status: "ALL", sortBy, page, limit: 2 })).data);
        }
        assert.deepEqual(
            pages.map((row) => String(row._id)),
            result.data.map((row) => String(row._id)),
        );
    });
}

test("search trims, ignores case, escapes metacharacters, and searches names only", async () => {
    const alpha = await list({ search: " ALpHa ", status: "ALL" });
    assert.deepEqual(alpha.counts, { all: 2, active: 2, archived: 0 });
    const literal = await list({ search: "[x].*", status: "ALL" });
    assert.deepEqual(
        literal.data.map((row) => row.name),
        ["Literal [x].*"],
    );
    assert.deepEqual(literal.counts, { all: 1, active: 0, archived: 1 });
    for (const search of ["not found", "description-only-token", "workspace-0", "(a+)+$"]) {
        const result = await list({ search, status: "ALL" });
        assert.deepEqual(result.data, []);
        assert.equal(result.pagination.total, 0);
        assert.deepEqual(result.counts, { all: 0, active: 0, archived: 0 });
    }
});

test("combined status/search/sort/pagination counts include other tabs", async () => {
    const result = await list({ search: "a", status: "ACTIVE", sortBy: "NAME_DESC", page: 2, limit: 2 });
    assert.deepEqual(
        result.data.map((row) => row.name),
        ["alpha", "ALPHA"],
    );
    assert.deepEqual(result.pagination, { page: 2, limit: 2, total: 4, totalPages: 2 });
    assert.deepEqual(result.counts, { all: 6, active: 4, archived: 2 });
});

test("first, middle, last, and out-of-range pages", async () => {
    for (const [page, length] of [
        [1, 2],
        [2, 2],
        [4, 1],
        [5, 0],
    ]) {
        const result = await list({ status: "ALL", page, limit: 2 });
        assert.equal(result.data.length, length);
        assert.deepEqual(result.pagination, { page, limit: 2, total: 7, totalPages: 4 });
        assert.deepEqual(result.counts, counts);
    }
});

test("empty user and empty status page retain correct metadata", async () => {
    const result = await list({}, emptyId);
    assert.deepEqual(result.data, []);
    assert.deepEqual(result.pagination, { page: 1, limit: 20, total: 0, totalPages: 0 });
    assert.deepEqual(result.counts, { all: 0, active: 0, archived: 0 });
    const archived = await request("?search=alpha&status=ARCHIVED");
    assert.deepEqual(archived.body.data, []);
    assert.deepEqual(archived.body.meta.counts, { all: 2, active: 2, archived: 0 });
});

test("POST compatibility, GET aliases, metadata, and enrichment DTO", async () => {
    const post = await request("/getall", { status: "ALL", sortBy: "name", sortOrder: "asc" });
    const get = await request("/getall?status=ALL&sortBy=NAME_ASC");
    const root = await request("?status=ALL&sortBy=NAME_ASC");
    assert.equal(post.status, 200);
    assert.deepEqual(post.body, get.body);
    assert.deepEqual(root.body, get.body);
    assert.deepEqual(root.body.meta.counts, counts);
    const owned = root.body.data.find((row) => row.id === String(rows[0]._id));
    assert.equal(owned.isOwner, true);
    assert.equal(owned.role, "Owner");
    assert.equal(owned.summary.folderCount, 1);
    assert.deepEqual(owned.summary.folders, [{ id: String(activeFolderId), name: "Ideas" }]);
    assert.ok(Array.isArray(owned.summary.members));
    for (const key of [
        "slug",
        "description",
        "ownerId",
        "visibility",
        "isPersonal",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
    ]) {
        assert.ok(key in owned, key);
    }
    const member = root.body.data.find((row) => row.id === String(rows[4]._id));
    assert.equal(member.summary.folderCount, 0);
    assert.deepEqual(member.summary.folders, []);
    assert.equal(member.isOwner, false);
    assert.equal(member.isInvited, true);
    assert.ok(!("membership" in member));
    assert.ok(!("access" in member));
    assert.ok(!("allowedActions" in member));
});

test("legacy ownerId cannot broaden access, and visibility/personal filters still work", async () => {
    const result = await request("/getall", { status: "ALL", ownerId: String(otherId) });
    assert.deepEqual(result.body.meta.counts, counts);
    const personal = await request("?isPersonal=true&visibility=PRIVATE");
    assert.deepEqual(
        personal.body.data.map((row) => row.name),
        ["Bravo"],
    );
    assert.deepEqual(personal.body.meta.counts, { all: 1, active: 1, archived: 0 });
    assert.equal((await request("?visibility=PUBLIC")).body.data.length, 0);
});

test("pagination coercion and maximum limit", async () => {
    const result = await request("/getall", { page: "1", limit: "999" });
    assert.equal(result.status, 200);
    assert.equal(result.body.meta.limit, 100);
    assert.equal(result.body.meta.page, 1);
});

test("invalid query and body parameters return standardized validation errors", async () => {
    for (const body of [
        { page: 0 },
        { page: -1 },
        { page: 1.5 },
        { page: true },
        { page: [] },
        { page: "1.5" },
        { page: "1e2" },
        { page: "" },
        { page: Number.MAX_SAFE_INTEGER },
        { limit: 0 },
        { limit: -1 },
        { limit: 1.1 },
        { limit: null },
        { status: "INACTIVE" },
        { status: "anything" },
        { sortBy: "$where" },
        { sortOrder: "bad" },
        { search: {} },
        { search: "a".repeat(101) },
        { isPersonal: "false" },
        { visibility: "bad" },
        { ownerId: "bad" },
        { unknown: true },
    ]) {
        const result = await request("/getall", body);
        assert.equal(result.status, 400, JSON.stringify(body));
        assert.equal(result.body.success, false);
        assert.ok(Array.isArray(result.body.error));
    }
    for (const query of ["page=0", "page=1&page=2", "search=a&search=b", "isPersonal=no", "status=UNKNOWN"]) {
        assert.equal((await request(`?${query}`)).status, 400, query);
    }
});

test("authentication is required and invalid authenticated IDs are rejected", async () => {
    assert.equal((await fetch(baseUrl)).status, 401);
    assert.equal((await request("", undefined, "not-an-id")).status, 401);
});

test("my endpoint retains its previous list behavior and metadata", async () => {
    const result = await request("/my");
    assert.equal(result.status, 200);
    assert.equal(result.body.data[0].isPersonal, true);
    assert.ok(result.body.data.some((row) => row.status === "INACTIVE"));
    assert.ok(result.body.data.every((row) => row.summary && row.role && "isOwner" in row));
});

test("access branches use existing indexes (executionStats)", async () => {
    for (const [model, filter] of [
        [WorkspaceModel, { ownerId, status: { $in: ["ACTIVE", "ARCHIVED"] } }],
        [WorkspaceMemberModel, { userId: ownerId, status: "ACTIVE" }],
    ]) {
        const explain = await model.find(filter).explain("executionStats");
        assert.ok(JSON.stringify(explain.queryPlanner.winningPlan).includes("IXSCAN"));
        assert.ok(explain.executionStats.totalDocsExamined < 15);
    }
});

test("access filters select owned/shared rows before pagination and keep independent access counts", async () => {
    for (const [access, total, statusCounts] of [
        ["ALL", 7, counts],
        ["OWNED", 4, { all: 4, active: 3, archived: 1 }],
        ["SHARED", 3, { all: 3, active: 2, archived: 1 }],
    ]) {
        for (const page of [1, 2, 100]) {
            const result = await list({ status: "ALL", access, limit: 1, page, sortBy: "NAME_ASC" });
            assert.equal(result.pagination.total, total);
            assert.deepEqual(result.accessCounts, { ALL: 7, OWNED: 4, SHARED: 3 });
            assert.deepEqual(result.counts, statusCounts);
            assert.equal(result.data.length, page <= total ? 1 : 0);
            if (access !== "ALL")
                assert.ok(
                    result.data.every(
                        (row) => (String(row.ownerId) === String(ownerId)) === (access === "OWNED"),
                    ),
                );
        }
        const get = await request(`/getall?status=ALL&access=${access}`);
        const post = await request("/getall", { status: "ALL", access });
        assert.deepEqual(get.body, post.body);
        assert.deepEqual(get.body.meta.accessFilters, [
            { value: "ALL", label: "All spaces", count: 7 },
            { value: "OWNED", label: "My spaces", count: 4 },
            { value: "SHARED", label: "Shared with me", count: 3 },
        ]);
    }
    assert.deepEqual((await list({ access: "SHARED", status: "ACTIVE" })).accessCounts, {
        ALL: 5,
        OWNED: 3,
        SHARED: 2,
    });
    assert.deepEqual((await list({ access: "OWNED", status: "ARCHIVED" })).accessCounts, {
        ALL: 2,
        OWNED: 1,
        SHARED: 1,
    });
    assert.deepEqual((await list({ status: "ALL", search: "alpha" })).accessCounts, {
        ALL: 2,
        OWNED: 1,
        SHARED: 1,
    });
    assert.deepEqual((await list({ status: "ALL", isPersonal: true, visibility: "PRIVATE" })).accessCounts, {
        ALL: 1,
        OWNED: 1,
        SHARED: 0,
    });
    assert.deepEqual((await list({ status: "ALL", visibility: "PUBLIC" })).accessCounts, {
        ALL: 0,
        OWNED: 0,
        SHARED: 0,
    });
    assert.deepEqual((await list({ status: "TRASHED", access: "SHARED" })).accessCounts, {
        ALL: 1,
        OWNED: 1,
        SHARED: 0,
    });
    assert.equal((await list({ status: "TRASHED", access: "SHARED" })).pagination.total, 0);
    for (const access of ["owned", "INVALID", null, ["ALL"]])
        assert.equal((await request("/getall", { access })).status, 400);
    assert.equal((await request("/getall?access=ALL&access=OWNED")).status, 400);
});

test("personal workspaces are isolated to owner and not shared", async () => {
    await WorkspaceModel.updateOne({ _id: rows[4]._id }, { $set: { isPersonal: true } });
    try {
        const shared = await request("/getall?status=ALL&access=SHARED&isPersonal=true");
        assert.equal(shared.body.meta.total, 0);
        const owned = (await request("/getall?isPersonal=true&access=OWNED")).body.data[0];
        assert.equal(owned.isPersonal, true);
        assert.equal(owned.isOwner, true);
        assert.equal(owned.role, "Owner");
        assert.equal(owned.label, "PERSONAL");
        assert.equal(owned.workspaceType, "PERSONAL");
        assert.equal(owned.workspaceTypeLabel, "Personal");
        assert.ok(!("access" in owned));
        assert.ok(!("allowedActions" in owned));
    } finally {
        await WorkspaceModel.updateOne({ _id: rows[4]._id }, { $set: { isPersonal: false } });
    }
});
