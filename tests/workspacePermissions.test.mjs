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
import { createHash, randomBytes } from "node:crypto";
import { WorkspaceMemberInvitationModel } from "../src/modules/workspaceInvitations/models/workspaceMemberInvitation.model.ts";
import { WorkspaceMemberInvitationService } from "../src/modules/workspaceInvitations/services/workspaceMemberInvitation.service.ts";
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
const { default: workspaceRoutes } = await import("../src/modules/workspace/routes/workspace.routes.ts");
let mongoProcess, directory, server, baseUrl;
const users = Object.fromEntries(["owner", "admin", "editor", "viewer", "stranger", "removed", "inactive", "empty", "own", "foreign"].map(name => [name, new Types.ObjectId()]));
const roles = {};
const permissionIds = {};
const service = new WorkspaceService();

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1"); await once(socket, "listening");
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    directory = await mkdtemp(join(tmpdir(), "workspace-permissions-test-"));
    mongoProcess = spawn(process.env.MONGOD_BINARY ?? "mongod", ["--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1",
        "--replSet", "workspacePermissions", "--logpath", join(directory, "mongo.log")], { windowsHide: true, stdio: "ignore" });
    let startupError; mongoProcess.on("error", error => { startupError = error; });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try { await mongoose.connect(`mongodb://127.0.0.1:${port}/workspace_permissions?directConnection=true`, { serverSelectionTimeoutMS: 500, autoIndex: false }); break; }
        catch (error) { if (attempt >= 40) throw error; await delay(250); }
    }
    await mongoose.connection.db.admin().command({ replSetInitiate: { _id: "workspacePermissions", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        assert.ok(attempt < 80); await delay(250);
    }
    for (const model of Object.values(mongoose.models)) await model.createCollection();
    await seedPermissions(); await seedRoles();
    for (const p of await PermissionModel.find().lean()) permissionIds[p.code] = p._id;
    for (const r of await RoleModel.find().lean()) roles[r.code] = r._id;
    roles.GLOBAL_READONLY = (await RoleModel.create({ name: "global-readonly", displayName: "Read only", code: "GLOBAL_READONLY", scope: "GLOBAL", permissions: [], isActive: true }))._id;
    roles.editor = (await RoleModel.create({ name: "editor", displayName: "Editor", code: "TEST_EDITOR", scope: "WORKSPACE", isSystem: true, isActive: true,
        permissions: [permissionIds.WORKSPACE_READ, permissionIds.WORKSPACE_UPDATE] }))._id;
    roles.empty = (await RoleModel.create({ name: "empty", displayName: "Empty", code: "TEST_EMPTY", scope: "WORKSPACE", isSystem: true, isActive: true, permissions: [] }))._id;
    roles.inactive = (await RoleModel.create({ name: "inactive", displayName: "Inactive", code: "TEST_INACTIVE", scope: "WORKSPACE", isSystem: true, isActive: false,
        permissions: [permissionIds.WORKSPACE_READ, permissionIds.WORKSPACE_UPDATE, permissionIds.WORKSPACE_DELETE] }))._id;
    const ownPermissions = [];
    for (const action of ["READ", "UPDATE", "DELETE", "SETTINGS", "ARCHIVE"]) {
        ownPermissions.push((await PermissionModel.create({ name: `workspace_${action.toLowerCase()}_own`, displayName: action, code: `WORKSPACE_${action}_OWN`, module: "WORKSPACE", action, access: "OWN", isActive: true }))._id);
    }
    roles.own = (await RoleModel.create({ name: "own", displayName: "Own", code: "TEST_OWN", scope: "WORKSPACE", isSystem: true, permissions: ownPermissions }))._id;
    roles.foreign = (await RoleModel.create({ name: "foreign", displayName: "Foreign", code: "TEST_FOREIGN", scope: "WORKSPACE", workspaceId: new Types.ObjectId(),
        isSystem: false, isActive: true, permissions: [permissionIds.WORKSPACE_READ, permissionIds.WORKSPACE_UPDATE, permissionIds.WORKSPACE_DELETE] }))._id;
    for (const [name, _id] of Object.entries(users)) await UserModel.create({ _id, email: `${name}@workspace.test`, status: "ACTIVE", globalRoleId: name === "owner" ? roles.USER : roles.GLOBAL_READONLY });
    mock.method(JwtUtil, "verifyAccessToken", token => ({ sub: token, sessionId: "test" }));
    const app = express(); app.use(express.json()); app.use(workspaceRoutes); app.use(errorMiddleware);
    server = app.listen(0, "127.0.0.1"); await once(server, "listening"); baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve)); mock.restoreAll(); await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) { const stopped = once(mongoProcess, "exit"); mongoProcess.kill(); await stopped; }
    if (directory) { const target = resolve(directory); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("workspace-permissions-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
});

async function fixture(status = "ACTIVE", name = new Types.ObjectId().toString()) {
    const ws = await WorkspaceModel.create({ name, slug: new Types.ObjectId().toString(), ownerId: users.owner, status });
    for (const actor of ["admin", "editor", "viewer", "removed", "inactive", "empty", "own", "foreign"]) {
        const roleId = roles[actor] ?? roles[actor === "admin" ? "WORKSPACE_ADMIN" : "WORKSPACE_VIEWER"];
        await WorkspaceMemberModel.create({ workspaceId: ws._id, userId: users[actor], roleId, status: actor === "removed" ? "REMOVED" : "ACTIVE" });
    }
    return ws;
}
async function request(method, path, actor = "owner", body) {
    const response = await fetch(baseUrl + path, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${users[actor] ?? actor}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
}

const actions = [
    ["details", "GET", "get", null, "ACTIVE", ["owner", "admin", "editor", "viewer"]],
    ["update", "PUT", "update", { name: "Edited" }, "ACTIVE", ["owner", "admin", "editor"]],
    ["visibility", "PUT", "update", { visibility: "PUBLIC" }, "ACTIVE", ["owner", "admin"]],
    ["archive", "PUT", "status", { status: "ARCHIVED" }, "ACTIVE", ["owner", "admin", "editor"]],
    ["unarchive", "PUT", "status", { status: "ACTIVE" }, "ARCHIVED", ["owner", "admin", "editor"]],
    ["suspend", "PUT", "status", { status: "SUSPENDED" }, "ACTIVE", ["owner", "admin"]],
    ["trash", "PUT", "trash", null, "ACTIVE", ["owner"]],
    ["delete alias", "DELETE", "delete", null, "ACTIVE", ["owner"]],
    ["restore", "PUT", "restore", null, "TRASHED", ["owner", "admin", "editor"]],
    ["permanent delete", "DELETE", "permanent", null, "TRASHED", ["owner"]],
];
for (const [label, method, path, body, status, allowed] of actions) {
    test(`${label}: owner, administrator, editor, viewer, stranger and invalid memberships through HTTP`, async () => {
        const ws = await fixture(status);
        // Owner last because permanent deletion removes the fixture.
        for (const actor of [...Object.keys(users).filter(name => name !== "owner"), "owner"]) {
            await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { status } });
            const before = await WorkspaceModel.findById(ws._id).lean();
            const result = await request(method, `/${path}/${ws._id}`, actor, body);
            assert.equal(result.status, allowed.includes(actor) ? 200 : 403, `${label}/${actor}: ${JSON.stringify(result.body)}`);
            if (!allowed.includes(actor)) assert.deepEqual(await WorkspaceModel.findById(ws._id).lean(), before);
        }
    });
}

test("creation uses active global CREATE permission; roles in other workspaces cannot grant it", async () => {
    const denied = await request("POST", "/create", "viewer", { name: "Denied" }); assert.equal(denied.status, 403);
    const allowed = await request("POST", "/create", "owner", { name: "Created", slug: new Types.ObjectId().toString() });
    assert.equal(allowed.status, 201); assert.equal(allowed.body.data.ownerId, String(users.owner));
    await RoleModel.updateOne({ _id: roles.USER }, { $set: { isActive: false } });
    assert.equal((await request("POST", "/create", "owner", { name: "Denied" })).status, 403);
    await RoleModel.updateOne({ _id: roles.USER }, { $set: { isActive: true } });
    await PermissionModel.updateOne({ _id: permissionIds.WORKSPACE_CREATE }, { $set: { isActive: false } });
    assert.equal((await request("POST", "/create", "owner", { name: "Denied" })).status, 403);
    await PermissionModel.updateOne({ _id: permissionIds.WORKSPACE_CREATE }, { $set: { isActive: true } });
    await UserModel.updateOne({ _id: users.owner }, { $set: { status: "SUSPENDED" } });
    assert.equal((await request("POST", "/create", "owner", { name: "Denied" })).status, 403);
    await UserModel.updateOne({ _id: users.owner }, { $set: { status: "ACTIVE" } });
    // Registration provisioning is separate from the externally callable create action.
    const personal = await service.createPersonalWorkspace({ name: "Personal", slug: new Types.ObjectId().toString() }, String(users.viewer));
    assert.equal(personal.isPersonal, true);
});

test("lists apply role/permission restrictions before search, counts and pagination on every alias", async () => {
    const marker = `Lists${new Types.ObjectId()}`; await fixture("ACTIVE", marker); await fixture("ARCHIVED", marker);
    for (const actor of Object.keys(users)) {
        const total = ["owner", "admin", "editor", "viewer"].includes(actor) ? 2 : 0;
        for (const [method, path, body] of [
            ["GET", `/?search=${marker}&status=ALL&limit=1`], ["GET", `/getall?search=${marker}&status=ALL&limit=1`],
            ["POST", "/getall", { search: marker, status: "ALL", limit: 1, ownerId: String(users.owner) }],
            ["GET", `/my?search=${marker}&limit=1`],
        ]) {
            const result = await request(method, path, actor, body); assert.equal(result.status, 200);
            assert.equal(result.body.meta.total, total, `${actor}/${path}`); assert.equal(result.body.data.length, Math.min(total, 1));
            if (result.body.meta.counts) assert.deepEqual(result.body.meta.counts, { all: total, active: total / 2, archived: total / 2 });
        }
    }
    await PermissionModel.updateOne({ _id: permissionIds.WORKSPACE_READ }, { $set: { isActive: false } });
    const revoked = await request("GET", `/getall?search=${marker}&status=ALL`, "viewer"); assert.equal(revoked.body.meta.total, 0);
    const owned = await request("GET", `/getall?search=${marker}&status=ALL`, "owner"); assert.equal(owned.body.meta.total, 2);
    await PermissionModel.updateOne({ _id: permissionIds.WORKSPACE_READ }, { $set: { isActive: true } });
});

test("inactive and trashed workspace restrictions cannot be bypassed using updates or status endpoints", async () => {
    const ws = await fixture("INACTIVE");
    assert.equal((await request("PUT", `/update/${ws._id}`, "owner", { name: "Denied" })).status, 403);
    assert.equal((await request("GET", `/get/${ws._id}`, "viewer")).status, 403);
    assert.equal((await request("PUT", `/status/${ws._id}`, "editor", { status: "ACTIVE" })).status, 403);
    assert.equal((await request("PUT", `/status/${ws._id}`, "admin", { status: "ACTIVE" })).status, 200);
    await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { status: "TRASHED" } });
    assert.equal((await request("PUT", `/update/${ws._id}`, "owner", { name: "Denied" })).status, 400);
    assert.equal((await request("PUT", `/status/${ws._id}`, "owner", { status: "ACTIVE" })).status, 400);
    assert.equal((await request("GET", `/get/${ws._id}`, "owner")).status, 404);
    assert.equal((await request("GET", `/getall?status=TRASHED&search=${ws.name}`, "viewer")).body.meta.total, 1);
    assert.equal((await request("GET", `/getall?status=TRASHED&search=${ws.name}`, "removed")).body.meta.total, 0);
});

test("payloads and alternate workspace IDs cannot grant access or mutate protected fields", async () => {
    const ws = await fixture(); const other = await WorkspaceModel.create({ name: "Other", slug: new Types.ObjectId().toString(), ownerId: users.viewer });
    assert.equal((await request("GET", `/get/${ws._id}?workspaceId=${other._id}`, "stranger")).status, 403);
    assert.equal((await request("DELETE", `/delete/${ws._id}?workspaceId=${other._id}`, "viewer")).status, 403);
    for (const payload of [{ ownerId: String(users.viewer) }, { isPersonal: true }, { status: "TRASHED" }, { permissions: ["WORKSPACE_DELETE"] }, { roleId: String(roles.WORKSPACE_OWNER) }, { createdBy: String(users.viewer) }]) {
        assert.equal((await request("PUT", `/update/${ws._id}`, "owner", payload)).status, 400);
        assert.equal((await request("POST", "/create", "owner", { name: "Attempt", ...payload })).status, 400);
    }
    assert.equal((await request("PUT", `/status/${ws._id}`, "owner", { status: "TRASHED" })).status, 400);
    assert.equal((await WorkspaceModel.findById(ws._id)).ownerId.toString(), String(users.owner));
    assert.equal((await request("GET", `/get/${new Types.ObjectId()}`, "viewer")).status, 404);
    assert.equal((await fetch(`${baseUrl}/get/${ws._id}`)).status, 401);
});

test("middleware context is reused once, while direct service calls still authorize", async () => {
    const ws = await fixture();
    const original = permissionAuthorizationService.resolveWorkspaceAuthorization;
    const spy = mock.method(permissionAuthorizationService, "resolveWorkspaceAuthorization", async function (...args) { return original.apply(this, args); });
    try {
        assert.equal((await request("PUT", `/update/${ws._id}`, "admin", { visibility: "PUBLIC" })).status, 200);
        assert.equal(spy.mock.callCount(), 1);
        await assert.rejects(service.updateWorkspace(String(ws._id), { name: "Denied" }, String(users.viewer)), error => error.statusCode === 403);
        await assert.rejects(service.getWorkspaceById(String(ws._id), String(users.stranger)), error => error.statusCode === 403);
        await assert.rejects(service.createWorkspace({ name: "Denied" }, String(users.viewer)), error => error.statusCode === 403);
        const auth = await original.call(permissionAuthorizationService, String(users.admin), String(ws._id));
        await assert.rejects(service.updateWorkspace(String(ws._id), { name: "Denied" }, String(users.viewer), undefined, auth), error => error.statusCode === 403);
    } finally { spy.mock.restore(); }
});

test("role changes, empty permissions and removal are enforced on the next request", async () => {
    const ws = await fixture();
    assert.equal((await request("PUT", `/update/${ws._id}`, "editor", { name: "Allowed" })).status, 200);
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.editor }, { $set: { roleId: roles.empty } });
    assert.equal((await request("PUT", `/update/${ws._id}`, "editor", { name: "Denied" })).status, 403);
    assert.equal((await request("GET", `/get/${ws._id}`, "editor")).status, 403);
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.viewer }, { $set: { status: "REMOVED" } });
    assert.equal((await request("GET", `/get/${ws._id}`, "viewer")).status, 403);
    // A workspace-owner template assigned to a non-owner never confers actual ownership.
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.editor }, { $set: { roleId: roles.WORKSPACE_OWNER } });
    assert.equal((await request("DELETE", `/delete/${ws._id}`, "editor")).status, 403);
});

test("accepted invitee creates an independent owned workspace while retaining editor/viewer roles elsewhere", async () => {
    const b = new Types.ObjectId();
    await UserModel.create({ _id: b, email: `${b}@workspace.test`, status: "ACTIVE", globalRoleId: roles.USER });
    const marker = `Independent${new Types.ObjectId()}`;
    const a = await WorkspaceModel.create({ name: `${marker} A`, slug: new Types.ObjectId().toString(), ownerId: users.owner });
    const c = await WorkspaceModel.create({ name: `${marker} C`, slug: new Types.ObjectId().toString(), ownerId: users.owner });
    const token = randomBytes(32).toString("hex");
    await WorkspaceMemberInvitationModel.create({ workspaceId: a._id, email: `${b}@workspace.test`, userId: b,
        roleId: roles.editor, invitedBy: users.owner, tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 86400000) });
    assert.equal((await request("GET", `/getall?search=${marker}&status=ALL`, String(b))).body.meta.total, 0);
    await new WorkspaceMemberInvitationService().acceptInvitation(token, String(b));
    assert.equal(String((await UserModel.findById(b)).globalRoleId), String(roles.USER));
    await WorkspaceMemberModel.create({ workspaceId: c._id, userId: b, roleId: roles.WORKSPACE_VIEWER, status: "ACTIVE" });
    const created = await request("POST", "/create", String(b), { name: `${marker} B`, slug: new Types.ObjectId().toString() });
    assert.equal(created.status, 201);
    const ownId = created.body.data.id;
    assert.equal(created.body.data.ownerId, String(b));
    // Even a duplicate viewer membership on one's own workspace cannot override ownership.
    await WorkspaceMemberModel.create({ workspaceId: ownId, userId: b, roleId: roles.WORKSPACE_VIEWER, status: "ACTIVE" });
    for (const [id, canEdit, label, expectedIsOwner] of [[ownId, true, "Owner", true], [String(a._id), true, "Editor", false], [String(c._id), false, "Workspace Viewer", false]]) {
        const detail = await request("GET", `/get/${id}`, String(b));
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.role, label);
        assert.equal(detail.body.data.isOwner, expectedIsOwner);
        assert.ok(!("allowedActions" in detail.body.data));
        assert.ok(!("access" in detail.body.data));
        assert.equal((await request("PUT", `/update/${id}`, String(b), { description: "Independent roles" })).status, canEdit ? 200 : 403);
    }
    const listed = await request("GET", `/getall?search=${marker}&status=ALL`, String(b));
    assert.equal(listed.body.meta.total, 3);
    assert.deepEqual(listed.body.meta.accessFilters.map(f => f.count), [3, 1, 2]);
    for (const card of listed.body.data) {
        const detail = await request("GET", `/get/${card.id}`, String(b));
        assert.equal(card.role, detail.body.data.role);
        assert.equal(card.isOwner, detail.body.data.isOwner);
    }
    assert.equal((await request("GET", `/get/${ownId}`, "owner")).status, 403);
    assert.equal((await request("PUT", `/update/${ownId}`, String(b), { visibility: "PUBLIC" })).status, 200);
    assert.equal((await request("PUT", `/trash/${ownId}`, String(b))).status, 200);
    assert.equal((await request("PUT", `/restore/${ownId}`, String(b))).status, 200);
    assert.equal((await request("PUT", `/trash/${ownId}`, String(b))).status, 200);
    assert.equal((await request("DELETE", `/permanent/${ownId}`, String(b))).status, 200);
});

test("supplied contexts recheck action, identity, target and workspace state without resolving twice", async () => {
    const ws = await fixture();
    const viewer = await permissionAuthorizationService.resolveWorkspaceAuthorization(String(users.viewer), String(ws._id));
    await assert.rejects(service.updateWorkspace(String(ws._id), { name: "Denied" }, String(users.viewer), undefined, viewer), e => e.statusCode === 403);
    await assert.rejects(service.deleteWorkspace(String(ws._id), String(users.viewer), undefined, viewer), e => e.statusCode === 403);
    const other = await fixture();
    await assert.rejects(service.updateWorkspace(String(other._id), { name: "Denied" }, String(users.viewer), undefined, viewer), e => e.statusCode === 403);
    await assert.rejects(service.createWorkspace({ name: "Denied" }, String(users.owner), undefined,
        { userId: String(users.owner), permissions: [] }), e => e.statusCode === 403);
    for (const [status, errorStatus] of [["TRASHED", 400], ["INACTIVE", 403], ["SUSPENDED", 403]]) {
        await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { status } });
        const permissive = await permissionAuthorizationService.resolveWorkspaceAuthorization(String(users.owner), String(ws._id), true, true);
        await assert.rejects(service.updateWorkspace(String(ws._id), { name: "Denied" }, String(users.owner), undefined, permissive), e => e.statusCode === errorStatus);
    }
});

test("ARCHIVE alone cannot trash or purge; explicit DELETE authorizes a workspace administrator", async () => {
    const ws = await fixture();
    const archive = await PermissionModel.create({ name: "workspace_archive", displayName: "Archive", code: "WORKSPACE_ARCHIVE", module: "WORKSPACE", action: "ARCHIVE", access: "GENERAL" });
    const role = await RoleModel.create({ name: "archiver", displayName: "Archiver", code: "TEST_ARCHIVER", scope: "WORKSPACE", workspaceId: ws._id,
        permissions: [permissionIds.WORKSPACE_READ, archive._id] });
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.editor }, { $set: { roleId: role._id } });
    assert.equal((await request("PUT", `/trash/${ws._id}`, "editor")).status, 403);
    assert.equal((await request("DELETE", `/delete/${ws._id}`, "editor")).status, 403);
    await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { status: "TRASHED" } });
    assert.equal((await request("DELETE", `/permanent/${ws._id}`, "editor")).status, 403);
    assert.equal((await request("PUT", `/restore/${ws._id}`, "editor")).status, 403);
    await RoleModel.updateOne({ _id: role._id }, { $push: { permissions: permissionIds.WORKSPACE_DELETE } });
    const trash = await request("GET", `/getall?status=TRASHED&search=${ws.name}`, "editor");
    assert.equal(trash.body.data[0].status, "TRASHED");
    assert.equal((await request("DELETE", `/permanent/${ws._id}`, "editor")).status, 200);
});

test("role updates and inactive memberships change list/detail metadata immediately", async () => {
    const ws = await fixture();
    const path = `/getall?search=${ws.name}`;
    let result = await request("GET", path, "viewer");
    assert.equal(result.body.data[0].role, "Workspace Viewer");
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.viewer }, { $set: { roleId: roles.editor } });
    result = await request("GET", path, "viewer");
    assert.equal(result.body.data[0].role, "Editor");
    const detail = await request("GET", `/get/${ws._id}`, "viewer");
    assert.equal(detail.body.data.role, "Editor");
    for (const status of ["REMOVED", "INVITED", "INACTIVE", "SUSPENDED", "REVOKED"]) {
        await WorkspaceMemberModel.collection.updateOne({ workspaceId: ws._id, userId: users.viewer }, { $set: { status } });
        result = await request("GET", path, "viewer");
        assert.equal(result.body.meta.total, 0);
        assert.deepEqual(result.body.meta.accessFilters.map(f => f.count), [0, 0, 0]);
        assert.equal((await request("GET", `/get/${ws._id}`, "viewer")).status, 403);
    }
});

test("GENERAL READ remains effective alongside OWN READ and card enrichment never resolves each workspace", async () => {
    const marker = `Mixed${new Types.ObjectId()}`;
    const ws = await fixture("ACTIVE", marker);
    const role = await RoleModel.create({ name: "mixed", displayName: "Mixed", code: "TEST_MIXED", scope: "WORKSPACE", workspaceId: ws._id,
        permissions: [permissionIds.WORKSPACE_READ, (await PermissionModel.findOne({ code: "WORKSPACE_READ_OWN" }))._id] });
    await WorkspaceMemberModel.updateOne({ workspaceId: ws._id, userId: users.viewer }, { $set: { roleId: role._id } });
    assert.equal((await request("GET", `/get/${ws._id}`, "viewer")).status, 200);
    const spy = mock.method(permissionAuthorizationService, "resolveWorkspaceAuthorization");
    try {
        for (const limit of [1, 100]) {
            const result = await request("GET", `/getall?search=${marker}&limit=${limit}`, "viewer");
            assert.equal(result.body.meta.total, 1);
            assert.equal(result.body.data[0].role, "Mixed");
        }
        assert.equal(spy.mock.callCount(), 0);
    } finally { spy.mock.restore(); }
});

test("pending/rejected/cancelled invitations never grant membership, list rows or counts", async () => {
    const marker = `Unaccepted${new Types.ObjectId()}`;
    for (const status of ["PENDING", "REJECTED", "CANCELLED"]) {
        const ws = await WorkspaceModel.create({ name: `${marker} ${status}`, slug: new Types.ObjectId().toString(), ownerId: users.owner });
        await WorkspaceMemberInvitationModel.create({ workspaceId: ws._id, email: "stranger@workspace.test", userId: users.stranger,
            roleId: roles.WORKSPACE_ADMIN, invitedBy: users.owner, tokenHash: randomBytes(32).toString("hex"),
            expiresAt: new Date(Date.now() + 86400000), status });
        assert.equal((await request("GET", `/get/${ws._id}`, "stranger")).status, 403);
    }
    const result = await request("GET", `/getall?search=${marker}&status=ALL`, "stranger");
    assert.equal(result.body.meta.total, 0);
    assert.deepEqual(result.body.meta.accessFilters.map(f => f.count), [0, 0, 0]);
});

test("status and retention metadata agree with existing service policies", async () => {
    const ws = await fixture("INACTIVE");
    const detail = await request("GET", `/get/${ws._id}`, "owner");
    assert.equal(detail.body.data.status, "INACTIVE");
    assert.equal((await request("PUT", `/status/${ws._id}`, "owner", { status: "ARCHIVED" })).status, 200);
    await WorkspaceModel.updateOne({ _id: ws._id }, { $set: { status: "TRASHED", purgeAfter: new Date(Date.now() - 1000) } });
    const result = await request("GET", `/getall?status=TRASHED&search=${ws.name}`, "owner");
    assert.equal(result.body.data[0].status, "TRASHED");
    assert.equal((await request("PUT", `/restore/${ws._id}`, "owner")).status, 410);
});
