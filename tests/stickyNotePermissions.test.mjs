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

import { StickyNoteModel } from "../src/modules/stickynotes/models/stickyNote.model.ts";
import { StickyNoteService } from "../src/modules/stickynotes/services/stickyNote.service.ts";
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
import { StickyNoteColumnModel } from "../src/modules/stickynotescolumns/models/stickyNoteColumn.model.ts";
import { WorkspaceFolderModel } from "../src/modules/workspaceFolders/models/workspaceFolder.model.ts";
import { UserModel } from "../src/modules/user/models/user.model.ts";

process.env.JWT_ACCESS_SECRET = "permission-test-access-secret";
process.env.JWT_REFRESH_SECRET = "permission-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: noteRoutes } = await import("../src/modules/stickynotes/routes/stickyNote.routes.ts");
const { default: memberRoutes } =
    await import("../src/modules/workspaceMember/routes/workspaceMember.routes.ts");

let mongoProcess, mongoDirectory, httpServer, baseUrl;

const ownerId = new Types.ObjectId();
const adminId = new Types.ObjectId();
const memberId = new Types.ObjectId();
const viewerId = new Types.ObjectId();
const strangerId = new Types.ObjectId();

const workspaceId = new Types.ObjectId();
const folderId = new Types.ObjectId();
let columnId;

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

    mongoDirectory = await mkdtemp(join(tmpdir(), "sticky-perm-test-"));
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
            "permTest",
            "--logpath",
            join(mongoDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongoProcess.on("error", (error) => {
        startupError = error;
    });

    const uri = `mongodb://127.0.0.1:${port}/sticky_perm_test`;
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
            replSetInitiate: { _id: "permTest", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
        });
        for (let attempt = 0; ; attempt++) {
            if ((await client.db("admin").command({ hello: 1 })).isWritablePrimary) break;
            assert.ok(attempt < 80, "Temporary replica set must elect a primary");
            await delay(250);
        }
    } finally {
        await client.close();
    }

    await mongoose.connect(`${uri}?replicaSet=permTest`, { autoIndex: false });

    // Seed Permissions
    const permNotesReadGeneral = await PermissionModel.create({
        name: "Read Notes",
        displayName: "Read Notes",
        code: "NOTES_READ_GENERAL",
        module: PermissionModule.NOTES,
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permNotesCreateGeneral = await PermissionModel.create({
        name: "Create Notes",
        displayName: "Create Notes",
        code: "NOTES_CREATE_GENERAL",
        module: PermissionModule.NOTES,
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permNotesUpdateOwn = await PermissionModel.create({
        name: "Update Own Notes",
        displayName: "Update Own Notes",
        code: "NOTES_UPDATE_OWN",
        module: PermissionModule.NOTES,
        action: PermissionAction.UPDATE,
        access: PermissionAccess.OWN,
        isActive: true,
    });
    const permNotesUpdateAny = await PermissionModel.create({
        name: "Update Any Notes",
        displayName: "Update Any Notes",
        code: "NOTES_UPDATE_ANY",
        module: PermissionModule.NOTES,
        action: PermissionAction.UPDATE,
        access: PermissionAccess.ANY,
        isActive: true,
    });
    const permNotesDeleteOwn = await PermissionModel.create({
        name: "Delete Own Notes",
        displayName: "Delete Own Notes",
        code: "NOTES_DELETE_OWN",
        module: PermissionModule.NOTES,
        action: PermissionAction.DELETE,
        access: PermissionAccess.OWN,
        isActive: true,
    });
    const permNotesDeleteAny = await PermissionModel.create({
        name: "Delete Any Notes",
        displayName: "Delete Any Notes",
        code: "NOTES_DELETE_ANY",
        module: PermissionModule.NOTES,
        action: PermissionAction.DELETE,
        access: PermissionAccess.ANY,
        isActive: true,
    });

    const permMembersRead = await PermissionModel.create({
        name: "Read Members",
        displayName: "Read Members",
        code: "MEMBERS_READ_GENERAL",
        module: PermissionModule.MEMBERS,
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permMembersInvite = await PermissionModel.create({
        name: "Invite Members",
        displayName: "Invite Members",
        code: "MEMBERS_INVITE_GENERAL",
        module: PermissionModule.MEMBERS,
        action: PermissionAction.INVITE,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permMembersAssign = await PermissionModel.create({
        name: "Assign Member Roles",
        displayName: "Assign Member Roles",
        code: "MEMBERS_ASSIGN_GENERAL",
        module: PermissionModule.MEMBERS,
        action: PermissionAction.ASSIGN,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });
    const permMembersRemove = await PermissionModel.create({
        name: "Remove Members",
        displayName: "Remove Members",
        code: "MEMBERS_REMOVE_GENERAL",
        module: PermissionModule.MEMBERS,
        action: PermissionAction.REMOVE,
        access: PermissionAccess.GENERAL,
        isActive: true,
    });

    // Seed Roles
    ownerRoleDoc = await RoleModel.create({
        name: "Workspace Owner",
        displayName: "Workspace Owner",
        code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER,
        type: RoleType.SYSTEM,
        scope: RoleScope.WORKSPACE,
        priority: 100,
        isSystem: true,
        isActive: true,
        permissions: [
            permNotesReadGeneral._id,
            permNotesCreateGeneral._id,
            permNotesUpdateAny._id,
            permNotesDeleteAny._id,
            permMembersRead._id,
            permMembersInvite._id,
            permMembersAssign._id,
            permMembersRemove._id,
        ],
    });

    adminRoleDoc = await RoleModel.create({
        name: "Workspace Admin",
        displayName: "Workspace Admin",
        code: SYSTEM_ROLE_CODES.WORKSPACE_ADMIN,
        type: RoleType.SYSTEM,
        scope: RoleScope.WORKSPACE,
        priority: 80,
        isSystem: true,
        isActive: true,
        permissions: [
            permNotesReadGeneral._id,
            permNotesCreateGeneral._id,
            permNotesUpdateAny._id,
            permNotesDeleteAny._id,
            permMembersRead._id,
            permMembersInvite._id,
            permMembersAssign._id,
            permMembersRemove._id,
        ],
    });

    memberRoleDoc = await RoleModel.create({
        name: "Workspace Member",
        displayName: "Workspace Member",
        code: SYSTEM_ROLE_CODES.WORKSPACE_MEMBER,
        type: RoleType.SYSTEM,
        scope: RoleScope.WORKSPACE,
        priority: 50,
        isSystem: true,
        isActive: true,
        permissions: [
            permNotesReadGeneral._id,
            permNotesCreateGeneral._id,
            permNotesUpdateOwn._id,
            permNotesDeleteOwn._id,
            permMembersRead._id,
        ],
    });

    viewerRoleDoc = await RoleModel.create({
        name: "Workspace Viewer",
        displayName: "Workspace Viewer",
        code: "WORKSPACE_VIEWER",
        type: RoleType.SYSTEM,
        scope: RoleScope.WORKSPACE,
        priority: 10,
        isSystem: true,
        isActive: true,
        permissions: [permNotesReadGeneral._id, permMembersRead._id],
    });

    // Seed Workspace & Hierarchy
    await WorkspaceModel.create({
        _id: workspaceId,
        name: "Test Workspace",
        slug: "test-workspace",
        ownerId,
        createdBy: ownerId,
        status: "ACTIVE",
    });

    await WorkspaceFolderModel.create({
        _id: folderId,
        workspaceId,
        name: "Default Folder",
        slug: "default-folder",
        status: "ACTIVE",
        createdBy: ownerId,
    });

    const col = await StickyNoteColumnModel.create({
        workspaceId,
        workspaceFolderId: folderId,
        name: "To Do",
        type: "TODO",
        createdBy: ownerId,
    });
    columnId = col._id;

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
    app.use("/api/v1/stickynotes", noteRoutes);
    app.use("/api/v1/workspacemembers", memberRoutes);

    app.use((err, _req, res, _next) => {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            success: false,
            message: err.message,
            statusCode,
        });
    });

    httpServer = app.listen(0);
    await once(httpServer, "listening");
    baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/v1`;
});

after(async () => {
    httpServer?.close();
    await mongoose.disconnect();
    mongoProcess?.kill();
    await delay(1000);
    if (mongoDirectory) {
        try {
            await rm(mongoDirectory, { recursive: true, force: true });
        } catch {
            // Windows file locking ignore
        }
    }
});

test("NOTES + CREATE: Member can create a note in active workspace", async () => {
    const res = await request(
        "/stickynotes/create",
        {
            method: "POST",
            body: JSON.stringify({
                workspaceId: workspaceId.toString(),
                workspaceFolderId: folderId.toString(),
                columnId: columnId.toString(),
                title: "Member note",
                content: "Content by member",
            }),
        },
        memberId,
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.data.title, "Member note");
});

test("NOTES + CREATE: Stranger without membership is rejected with 403", async () => {
    const res = await request(
        "/stickynotes/create",
        {
            method: "POST",
            body: JSON.stringify({
                workspaceId: workspaceId.toString(),
                workspaceFolderId: folderId.toString(),
                columnId: columnId.toString(),
                title: "Stranger note",
                content: "Content by stranger",
            }),
        },
        strangerId,
    );

    assert.equal(res.status, 403);
});

test("NOTES + UPDATE: OWN vs ANY access control", async () => {
    // 1. Create a note owned by owner
    const ownerNote = await StickyNoteModel.create({
        workspaceId,
        workspaceFolderId: folderId,
        columnId,
        stickyNoteNumber: 101,
        title: "Owner Original",
        content: "Initial text",
        createdBy: ownerId,
        updatedBy: ownerId,
    });

    // 2. Create a note owned by member
    const memberNote = await StickyNoteModel.create({
        workspaceId,
        workspaceFolderId: folderId,
        columnId,
        stickyNoteNumber: 102,
        title: "Member Original",
        content: "Initial text",
        createdBy: memberId,
        updatedBy: memberId,
    });

    // 3. Member updating their OWN note -> Allowed (200)
    const updateOwnRes = await request(
        `/stickynotes/update/${memberNote._id}`,
        {
            method: "PUT",
            body: JSON.stringify({ title: "Member Updated Self" }),
        },
        memberId,
    );
    assert.equal(updateOwnRes.status, 200);

    // 4. Member updating OWNER's note -> Forbidden (403) because member only has NOTES_UPDATE_OWN
    const updateOtherRes = await request(
        `/stickynotes/update/${ownerNote._id}`,
        {
            method: "PUT",
            body: JSON.stringify({ title: "Hacked by Member" }),
        },
        memberId,
    );
    assert.equal(updateOtherRes.status, 403);

    // 5. Admin updating MEMBER's note -> Allowed (200) because admin has NOTES_UPDATE_ANY
    const adminUpdateMemberRes = await request(
        `/stickynotes/update/${memberNote._id}`,
        {
            method: "PUT",
            body: JSON.stringify({ title: "Admin Edit" }),
        },
        adminId,
    );
    assert.equal(adminUpdateMemberRes.status, 200);
});

test("NOTES + DELETE: OWN vs ANY access control", async () => {
    const ownerNote = await StickyNoteModel.create({
        workspaceId,
        workspaceFolderId: folderId,
        columnId,
        stickyNoteNumber: 201,
        title: "Owner Note for Delete Test",
        content: "Text",
        createdBy: ownerId,
        updatedBy: ownerId,
    });

    const memberNote = await StickyNoteModel.create({
        workspaceId,
        workspaceFolderId: folderId,
        columnId,
        stickyNoteNumber: 202,
        title: "Member Note for Delete Test",
        content: "Text",
        createdBy: memberId,
        updatedBy: memberId,
    });

    // Member trying to delete Owner note -> 403
    const memberDeleteOwnerRes = await request(
        `/stickynotes/delete/${ownerNote._id}`,
        { method: "DELETE" },
        memberId,
    );
    assert.equal(memberDeleteOwnerRes.status, 403);

    // Member deleting their own note -> 200
    const memberDeleteSelfRes = await request(
        `/stickynotes/delete/${memberNote._id}`,
        { method: "DELETE" },
        memberId,
    );
    assert.equal(memberDeleteSelfRes.status, 200);
});

test("MEMBERS: Viewer without manage permission cannot update member roles (403)", async () => {
    const res = await request(
        `/workspacemembers/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: viewerRoleDoc._id.toString() }),
        },
        viewerId,
    );

    assert.equal(res.status, 403);
});

test("MEMBERS: Role priority prevents Admin (priority 80) from assigning Owner role (priority 100)", async () => {
    const res = await request(
        `/workspacemembers/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: ownerRoleDoc._id.toString() }),
        },
        adminId,
    );

    assert.equal(res.status, 400); // System role owner cannot be assigned or higher priority
});

test("MEMBERS: Role priority prevents Admin (priority 80) from assigning equal or higher role priority", async () => {
    // Admin trying to assign Admin role (priority 80 >= 80)
    const res = await request(
        `/workspacemembers/role/${memberMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: adminRoleDoc._id.toString() }),
        },
        adminId,
    );

    assert.equal(res.status, 403);
    assert.match(res.body.message, /equal or higher priority/i);
});

test("MEMBERS: Self-removal is prevented (400 CANNOT_REMOVE_SELF)", async () => {
    const res = await request(`/workspacemembers/delete/${adminMembershipId}`, { method: "DELETE" }, adminId);

    if (res.status !== 400) {
        console.error("Subtest 8 unexpected response:", JSON.stringify(res.body));
    }
    assert.equal(res.status, 400);
    assert.match(res.body.message, /cannot remove themselves/i);
});

test("MEMBERS: Owner can assign Member role to Admin", async () => {
    const res = await request(
        `/workspacemembers/role/${adminMembershipId}`,
        {
            method: "PUT",
            body: JSON.stringify({ roleId: memberRoleDoc._id.toString() }),
        },
        ownerId,
    );

    assert.equal(res.status, 200);
    const assignedRoleId = res.body.data.roleId?._id?.toString() || res.body.data.roleId?.toString();
    assert.equal(assignedRoleId, memberRoleDoc._id.toString());
});

test("MEMBERS: add, list and audit use the workspace member permissions", async () => {
    const target = new Types.ObjectId();
    await UserModel.collection.insertOne({
        _id: target,
        email: "new-member@test.com",
        username: "new-member",
        isDeleted: false,
    });
    const input = {
        workspaceId: String(workspaceId),
        userId: String(target),
        roleId: String(viewerRoleDoc._id),
    };
    const path = "/workspacemembers/create";
    assert.equal(
        (await request(path, { method: "POST", body: JSON.stringify(input) }, viewerId)).status,
        403,
    );
    assert.equal(
        (await request(path, { method: "POST", body: JSON.stringify(input) }, strangerId)).status,
        403,
    );
    assert.equal(
        (
            await request(
                path,
                { method: "POST", body: JSON.stringify({ ...input, status: "ACTIVE" }) },
                ownerId,
            )
        ).status,
        400,
    );
    const created = await request(path, { method: "POST", body: JSON.stringify(input) }, ownerId);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.data.status, "ACTIVE");
    assert.equal((await request(path, { method: "POST", body: JSON.stringify(input) }, ownerId)).status, 409);
    const list = await request(
        `/workspacemembers/getall?workspaceId=${workspaceId}&roleId=${viewerRoleDoc._id}&search=new-member&page=1&limit=1`,
        {},
        ownerId,
    );
    assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.meta.total, 1);
    assert.equal(list.body.data[0].user.id, String(target));
    assert.equal(
        (await request(`/workspacemembers/getall?workspaceId=${workspaceId}&page=0`, {}, ownerId)).status,
        400,
    );
    const log = await AuditLogModel.findOne({
        resourceId: new Types.ObjectId(created.body.data._id),
        action: "ASSIGN",
    }).lean();
    assert.equal(String(log.actorId), String(ownerId));
    assert.equal(log.metadata.workspaceId, String(workspaceId));
});

test("MEMBERS: a workspace hint cannot redirect target authorization", async () => {
    const member = await WorkspaceMemberModel.findById(memberMembershipId);
    const otherWorkspace = new Types.ObjectId();
    const path = `/workspacemembers/get/${member._id}?workspaceId=${otherWorkspace}`;
    assert.equal((await request(path, {}, ownerId)).status, 403);
    assert.equal(
        (
            await request(
                `/workspacemembers/role/${member._id}?workspaceId=${otherWorkspace}`,
                { method: "PUT", body: JSON.stringify({ roleId: String(viewerRoleDoc._id) }) },
                ownerId,
            )
        ).status,
        403,
    );
    const protectedOwner = await WorkspaceMemberModel.create({
        workspaceId,
        userId: ownerId,
        roleId: ownerRoleDoc._id,
        status: "ACTIVE",
    });
    assert.equal(
        (
            await request(
                `/workspacemembers/role/${protectedOwner._id}`,
                { method: "PUT", body: JSON.stringify({ roleId: String(viewerRoleDoc._id) }) },
                ownerId,
            )
        ).status,
        400,
    );
    assert.equal(
        (await request(`/workspacemembers/delete/${protectedOwner._id}`, { method: "DELETE" }, ownerId))
            .status,
        400,
    );
    assert.equal(
        (
            await request(
                `/workspacemembers/update/${member._id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({ roleId: String(viewerRoleDoc._id), status: "REMOVED" }),
                },
                ownerId,
            )
        ).status,
        400,
    );
    const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
        String(ownerId),
        String(workspaceId),
    );
    await assert.rejects(
        () =>
            new WorkspaceMemberService().getWorkspaceMemberById(String(member._id), String(strangerId), auth),
        (error) => error.statusCode === 403,
    );
});

test("MEMBERS: remove, restore and failed audit preserve membership state", async () => {
    const target = new Types.ObjectId();
    await UserModel.collection.insertOne({
        _id: target,
        email: "lifecycle@test.com",
        username: "lifecycle",
        isDeleted: false,
    });
    const member = await WorkspaceMemberModel.create({
        workspaceId,
        userId: target,
        roleId: viewerRoleDoc._id,
        status: "ACTIVE",
    });
    assert.equal(
        (await request(`/workspacemembers/delete/${member._id}`, { method: "DELETE" }, viewerId)).status,
        403,
    );
    assert.equal(
        (await request(`/workspacemembers/delete/${member._id}`, { method: "DELETE" }, ownerId)).status,
        200,
    );
    assert.equal((await WorkspaceMemberModel.findById(member._id)).status, "REMOVED");
    assert.equal(
        (await request(`/workspacemembers/restore/${member._id}`, { method: "PUT" }, viewerId)).status,
        403,
    );
    assert.equal(
        (await request(`/workspacemembers/restore/${member._id}`, { method: "PUT" }, ownerId)).status,
        200,
    );
    const failure = mock.method(AuditLogService.prototype, "log", async () => {
        throw new Error("audit unavailable");
    });
    try {
        const changed = await request(
            `/workspacemembers/role/${member._id}`,
            { method: "PUT", body: JSON.stringify({ roleId: String(memberRoleDoc._id) }) },
            ownerId,
        );
        assert.equal(changed.status, 500);
        assert.equal(
            String((await WorkspaceMemberModel.findById(member._id)).roleId),
            String(viewerRoleDoc._id),
        );
    } finally {
        failure.mock.restore();
    }
    const removeFailure = mock.method(AuditLogService.prototype, "log", async () => {
        throw new Error("audit unavailable");
    });
    try {
        assert.equal(
            (await request(`/workspacemembers/delete/${member._id}`, { method: "DELETE" }, ownerId)).status,
            500,
        );
        assert.equal((await WorkspaceMemberModel.findById(member._id)).status, "ACTIVE");
    } finally {
        removeFailure.mock.restore();
    }
    assert.equal(
        (await request(`/workspacemembers/delete/${member._id}`, { method: "DELETE" }, ownerId)).status,
        200,
    );
    const restoreFailure = mock.method(AuditLogService.prototype, "log", async () => {
        throw new Error("audit unavailable");
    });
    try {
        assert.equal(
            (await request(`/workspacemembers/restore/${member._id}`, { method: "PUT" }, ownerId)).status,
            500,
        );
        assert.equal((await WorkspaceMemberModel.findById(member._id)).status, "REMOVED");
    } finally {
        restoreFailure.mock.restore();
    }
});
