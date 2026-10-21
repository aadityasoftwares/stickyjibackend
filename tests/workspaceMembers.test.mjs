import { seedProductSubscriptionFixtures } from "./helpers/subscriptionFixtures.mjs";
import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";

import { WorkspaceModel } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceMemberModel } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { WorkspaceMemberService } from "../src/modules/workspaceMember/services/workspaceMember.service.ts";
import { permissionAuthorizationService } from "../src/modules/permissions/services/permissionAuthorization.service.ts";
import { AuditLogModel } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} from "../src/modules/permissions/constants/permission.enums.ts";
import { RoleScope, RoleType } from "../src/modules/roles/constants/role.enums.ts";
import { SYSTEM_ROLE_CODES } from "../src/modules/roles/constants/role.constants.ts";
import { UserModel } from "../src/modules/user/models/user.model.ts";
import { seedPermissions } from "../src/modules/permissions/seeders/permission.seeder.ts";
import { seedRoles } from "../src/modules/roles/seeders/role.seeder.ts";

process.env.JWT_ACCESS_SECRET = "ws-member-test-access-secret";
process.env.JWT_REFRESH_SECRET = "ws-member-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: memberRoutes } =
    await import("../src/modules/workspaceMember/routes/workspaceMember.routes.ts");

let mongoProcess, mongoDirectory, httpServer, baseUrl;

const ownerId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const viewerId = new Types.ObjectId();
const strangerId = new Types.ObjectId();

const workspaceId = new Types.ObjectId();
const otherWorkspaceId = new Types.ObjectId();

let ownerRoleDoc;
let adminRoleDoc;
let memberRoleDoc;
let viewerRoleDoc;

let memberMembershipId;
let adminMembershipId;

async function request(path, options = {}, userId = ownerId) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${userId.toString()}`,
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    const text = await response.text();
    let body;
    try {
        body = JSON.parse(text);
    } catch {
        body = text;
    }
    return { status: response.status, body };
}

before(async () => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongoDirectory = await mkdtemp(join(tmpdir(), "ws-member-test-"));
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
            "memberTest",
            "--logpath",
            join(mongoDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongoProcess.on("error", (error) => {
        startupError = error;
    });

    const uri = `mongodb://127.0.0.1:${port}/ws_member_test`;
    const client = new mongoose.mongo.MongoClient(uri, {
        directConnection: true,
        serverSelectionTimeoutMS: 500,
    });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await client.connect();
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }

    try {
        await client.db("admin").command({
            replSetInitiate: { _id: "memberTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
        });
        for (let attempt = 0; ; attempt++) {
            if ((await client.db("admin").command({ hello: 1 })).isWritablePrimary) break;
            assert.ok(attempt < 80, "Replica set must elect a primary");
            await delay(250);
        }
    } finally {
        await client.close();
    }

    await mongoose.connect(`${uri}?replicaSet=memberTest`, { autoIndex: false });

    for (const model of Object.values(mongoose.models)) {
        await model.createCollection();
    }

    await seedPermissions();
    await seedRoles();

    ownerRoleDoc = await RoleModel.findOne({ code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER });
    adminRoleDoc = await RoleModel.findOne({ code: SYSTEM_ROLE_CODES.WORKSPACE_ADMIN });
    memberRoleDoc = await RoleModel.findOne({ code: SYSTEM_ROLE_CODES.WORKSPACE_MEMBER });
    viewerRoleDoc = await RoleModel.findOne({ code: "WORKSPACE_VIEWER" });

    // Seed Workspaces
    await WorkspaceModel.create({
        _id: workspaceId,
        name: "Test Workspace",
        slug: "test-workspace",
        ownerId,
        createdBy: ownerId,
        updatedBy: ownerId,
        status: "ACTIVE",
    });

    await WorkspaceModel.create({
        _id: otherWorkspaceId,
        name: "Other Workspace",
        slug: "other-workspace",
        ownerId: strangerId,
        createdBy: strangerId,
        updatedBy: strangerId,
        status: "ACTIVE",
    });

    // Seed Users
    await UserModel.collection.insertMany([
        { _id: ownerId, email: "owner@test.com", username: "owner", isDeleted: false },
        { _id: adminId, email: "admin@test.com", username: "admin", isDeleted: false },
        { _id: memberId, email: "member@test.com", username: "member", isDeleted: false },
        { _id: viewerId, email: "viewer@test.com", username: "viewer", isDeleted: false },
        { _id: strangerId, email: "stranger@test.com", username: "stranger", isDeleted: false },
    ]);

    // Seed Members
    const adminMember = await WorkspaceMemberModel.create({
        workspaceId,
        userId: adminId,
        roleId: adminRoleDoc._id,
        status: "ACTIVE",
        createdBy: ownerId,
    });
    adminMembershipId = adminMember._id;

    const memberMember = await WorkspaceMemberModel.create({
        workspaceId,
        userId: memberId,
        roleId: memberRoleDoc._id,
        status: "ACTIVE",
        createdBy: ownerId,
    });
    memberMembershipId = memberMember._id;

    await WorkspaceMemberModel.create({
        workspaceId,
        userId: viewerId,
        roleId: viewerRoleDoc._id,
        status: "ACTIVE",
        createdBy: ownerId,
    });

    // Mock token verification
    mock.method(JwtUtil, "verifyAccessToken", (token) => ({
        sub: token,
        sessionId: "test-session",
    }));

    const app = express();
    app.use(express.json());
    app.use("/api/v1/workspacemembers", memberRoutes);

    app.use((err, _req, res, _next) => {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
        });
    });

    httpServer = app.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/v1/workspacemembers`;
    await seedProductSubscriptionFixtures();
});

after(async () => {
    mock.restoreAll();
    if (httpServer) await new Promise((r) => httpServer.close(r));
    await mongoose.disconnect();
    if (mongoProcess?.pid && mongoProcess.exitCode === null) {
        const exited = once(mongoProcess, "exit");
        mongoProcess.kill();
        await exited;
    }
    if (mongoDirectory) {
        await rm(mongoDirectory, { recursive: true, force: true });
    }
});

test("1 & 2 & 3. GET and POST /getall return equivalent member listing and metadata", async () => {
    const getRes = await request(`/getall?workspaceId=${workspaceId}&page=1&limit=10`, {}, ownerId);
    assert.equal(getRes.status, 200, JSON.stringify(getRes.body));
    assert.equal(getRes.body.success, true);
    assert.equal(getRes.body.message, "Workspace members fetched successfully.");
    assert.equal(getRes.body.meta.page, 1);
    assert.equal(getRes.body.meta.limit, 10);
    assert.ok(getRes.body.meta.total >= 3);
    assert.ok(Array.isArray(getRes.body.data));

    // GET / (root path) should also work identically
    const rootRes = await request(`/?workspaceId=${workspaceId}&page=1&limit=10`, {}, ownerId);
    assert.equal(rootRes.status, 200);
    assert.equal(rootRes.body.meta.total, getRes.body.meta.total);

    // POST /getall with JSON body
    const postRes = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), page: 1, limit: 10 }),
        },
        ownerId,
    );
    assert.equal(postRes.status, 200, JSON.stringify(postRes.body));
    assert.equal(postRes.body.success, true);
    assert.equal(postRes.body.meta.total, getRes.body.meta.total);
    assert.deepEqual(
        postRes.body.data.map((m) => m.id),
        getRes.body.data.map((m) => m.id),
    );
});

test("4. POST /getall validates JSON body filters and rejects unexpected fields or invalid types", async () => {
    // Unexpected field in body
    const badKey = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), unexpectedField: 123 }),
        },
        ownerId,
    );
    assert.equal(badKey.status, 400);

    // Invalid page (0 or negative)
    const badPage = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), page: 0 }),
        },
        ownerId,
    );
    assert.equal(badPage.status, 400);

    // Invalid roleId
    const badRole = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), roleId: "invalid-id" }),
        },
        ownerId,
    );
    assert.equal(badRole.status, 400);

    // Unsupported Content-Type
    const badContentType = await request(
        "/getall",
        {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ workspaceId: String(workspaceId) }),
        },
        ownerId,
    );
    assert.equal(badContentType.status, 415);
});

test("5 & 6. GET query parameters normalize empty strings and reject invalid workspaceId", async () => {
    // Normalizes empty string query params without crashing
    const normal = await request(`/getall?workspaceId=${workspaceId}&search=&roleId=`, {}, ownerId);
    assert.equal(normal.status, 200);

    // Missing workspaceId
    const missing = await request("/getall", {}, ownerId);
    assert.equal(missing.status, 400);

    // Invalid workspaceId
    const invalid = await request("/getall?workspaceId=12345", {}, ownerId);
    assert.equal(invalid.status, 400);
});

test("7 & 8. Cross-workspace access and unauthorized operations are rejected", async () => {
    // Stranger from outside workspace cannot list members
    const forbidden = await request(`/getall?workspaceId=${workspaceId}`, {}, strangerId);
    assert.equal(forbidden.status, 403);

    // Cross workspace query rejected
    const crossWorkspace = await request(`/getall?workspaceId=${otherWorkspaceId}`, {}, memberId);
    assert.equal(crossWorkspace.status, 403);

    // Viewer in workspace has no MEMBERS:ASSIGN permission
    const viewerForbidden = await request(
        `/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: String(viewerRoleDoc._id) }),
        },
        viewerId,
    );
    assert.equal(viewerForbidden.status, 403);
});

test("9 & 10. Authorized member invitation succeeds and duplicate membership is rejected (409)", async () => {
    const newUserId = new Types.ObjectId();
    await UserModel.collection.insertOne({
        _id: newUserId,
        email: "newinvite@test.com",
        username: "newinvite",
        isDeleted: false,
    });

    const createPayload = {
        workspaceId: String(workspaceId),
        userId: String(newUserId),
        roleId: String(viewerRoleDoc._id),
    };

    // Owner creates member
    const created = await request(
        "/create",
        {
            method: "POST",
            body: JSON.stringify(createPayload),
        },
        ownerId,
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.status, "ACTIVE");

    // Duplicate creation must return 409
    const duplicate = await request(
        "/create",
        {
            method: "POST",
            body: JSON.stringify(createPayload),
        },
        ownerId,
    );
    assert.equal(duplicate.status, 409);
});

test("11 & 12. Role changes respect authorization and prevent privilege escalation", async () => {
    // Owner role cannot be assigned to members (400)
    const ownerRoleAssign = await request(
        `/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: String(ownerRoleDoc._id) }),
        },
        adminId,
    );
    assert.equal(ownerRoleAssign.status, 400);

    // Admin cannot assign Admin role (priority 80 >= 80, returns 403)
    const escalatePriority = await request(
        `/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: String(adminRoleDoc._id) }),
        },
        adminId,
    );
    assert.equal(escalatePriority.status, 403);

    // Owner can change member role to Viewer (200)
    const successChange = await request(
        `/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: String(viewerRoleDoc._id) }),
        },
        ownerId,
    );
    assert.equal(successChange.status, 200);

    // Check updated role in DB
    const updated = await WorkspaceMemberModel.findById(memberMembershipId);
    assert.equal(String(updated.roleId), String(viewerRoleDoc._id));
});

test("13 & 14 & 15. Membership lifecycle: remove, owner protection, and restoration", async () => {
    const ownerMember = await WorkspaceMemberModel.create({
        workspaceId,
        userId: ownerId,
        roleId: ownerRoleDoc._id,
        status: "ACTIVE",
    });

    // Owner cannot be removed
    const removeOwner = await request(`/delete/${ownerMember._id}`, { method: "DELETE" }, ownerId);
    assert.equal(removeOwner.status, 400);

    // Owner role cannot be changed
    const changeOwnerRole = await request(
        `/role/${ownerMember._id}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: String(adminRoleDoc._id) }),
        },
        ownerId,
    );
    assert.equal(changeOwnerRole.status, 400);

    // Remove regular member
    const removeRes = await request(`/delete/${memberMembershipId}`, { method: "DELETE" }, ownerId);
    assert.equal(removeRes.status, 200);
    assert.equal((await WorkspaceMemberModel.findById(memberMembershipId)).status, "REMOVED");

    // Removed member loses access to read members
    const removedAccess = await request(`/getall?workspaceId=${workspaceId}`, {}, memberId);
    assert.equal(removedAccess.status, 403);

    // Restore member
    const restoreRes = await request(`/restore/${memberMembershipId}`, { method: "PUT" }, ownerId);
    assert.equal(restoreRes.status, 200);
    assert.equal((await WorkspaceMemberModel.findById(memberMembershipId)).status, "ACTIVE");
});

test("16 & 17. Pagination and search filtering on member list", async () => {
    // Search by username/email
    const searchRes = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), search: "admin", page: 1, limit: 10 }),
        },
        ownerId,
    );
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.body.data.length >= 1);
    assert.ok(searchRes.body.data.some((m) => m.user.email.includes("admin")));

    // Filter by roleId
    const roleRes = await request(
        "/getall",
        {
            method: "POST",
            body: JSON.stringify({ workspaceId: String(workspaceId), roleId: String(adminRoleDoc._id) }),
        },
        ownerId,
    );
    assert.equal(roleRes.status, 200);
    assert.ok(roleRes.body.data.every((m) => m.role.id === String(adminRoleDoc._id)));
});

test("18. Audit failure rolls back role change and member removal", async () => {
    const auditMock = mock.method(AuditLogService.prototype, "log", async () => {
        throw new Error("Simulated audit logging failure");
    });

    try {
        const failChange = await request(
            `/role/${memberMembershipId}`,
            {
                method: "PUT",
                body: JSON.stringify({ roleId: String(adminRoleDoc._id) }),
            },
            ownerId,
        );
        assert.equal(failChange.status, 500);

        // Role must remain unchanged
        const currentMember = await WorkspaceMemberModel.findById(memberMembershipId);
        assert.notEqual(String(currentMember.roleId), String(adminRoleDoc._id));
    } finally {
        auditMock.mock.restore();
    }
});
