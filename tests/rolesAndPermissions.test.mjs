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

import { RoleModel as Role } from "../src/modules/roles/models/role.model.ts";
import { PermissionModel as Permission } from "../src/modules/permissions/models/permission.model.ts";
import { WorkspaceModel as Workspace } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceMemberModel as Member } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { WorkspaceMemberInvitationModel as Invitation } from "../src/modules/workspaceInvitations/models/workspaceMemberInvitation.model.ts";
import { UserModel as User } from "../src/modules/user/models/user.model.ts";
import { AuditLogModel as Audit } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { RoleService } from "../src/modules/roles/services/role.service.ts";
import { PermissionService } from "../src/modules/permissions/services/permission.service.ts";
import { permissionAuthorizationService } from "../src/modules/permissions/services/permissionAuthorization.service.ts";
import { seedPermissions } from "../src/modules/permissions/seeders/permission.seeder.ts";
import { seedRoles } from "../src/modules/roles/seeders/role.seeder.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";
import { SYSTEM_ROLE_CODES } from "../src/modules/roles/constants/role.constants.js";
import { RoleScope, RoleType } from "../src/modules/roles/constants/role.enums.js";
import { PermissionAction, PermissionModule } from "../src/modules/permissions/constants/permission.enums.js";

process.env.JWT_ACCESS_SECRET = "roles-permissions-test-secret";
process.env.JWT_REFRESH_SECRET = "roles-permissions-test-refresh";

const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: roleRoutes } = await import("../src/modules/roles/routes/role.routes.ts");
const { default: permissionRoutes } = await import("../src/modules/permissions/routes/permission.routes.ts");

const roleService = new RoleService();
const permissionService = new PermissionService();

const roles = {};
let directory, mongo, server, url, owner, adminUser, regularMember, outsiderUser, superAdminUser;

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((res) => socket.close(res));

    directory = await mkdtemp(join(tmpdir(), "roles-permissions-test-"));
    mongo = spawn(
        process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            directory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--replSet",
            "roles-permissions",
            "--logpath",
            join(directory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongo.on("error", (err) => {
        startupError = err;
    });

    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/roles_permissions?directConnection=true`, {
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
        replSetInitiate: { _id: "roles-permissions", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
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

    await Role.createIndexes();
    await Permission.createIndexes();
    await Member.createIndexes();
    await Workspace.createIndexes();
    await Invitation.createIndexes();

    for (const r of await Role.find().lean()) {
        roles[r.code] = r._id;
    }

    superAdminUser = await createUser(roles[SYSTEM_ROLE_CODES.SUPER_ADMIN]);
    owner = await createUser(roles[SYSTEM_ROLE_CODES.USER]);
    adminUser = await createUser(roles[SYSTEM_ROLE_CODES.USER]);
    regularMember = await createUser(roles[SYSTEM_ROLE_CODES.USER]);
    outsiderUser = await createUser(roles[SYSTEM_ROLE_CODES.USER]);

    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "roles-test" }));

    const app = express();
    app.use(express.json());
    app.use("/roles", roleRoutes);
    app.use("/permissions", permissionRoutes);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise((res) => server.close(res));
    mock.restoreAll();
    await mongoose.disconnect();
    if (mongo?.pid && mongo.exitCode === null) {
        const stopped = once(mongo, "exit");
        mongo.kill();
        await stopped;
    }
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("roles-permissions-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

async function createUser(globalRoleId) {
    const id = new Types.ObjectId();
    return User.create({
        _id: id,
        email: `${id}@example.test`,
        status: "ACTIVE",
        globalRoleId: globalRoleId || roles[SYSTEM_ROLE_CODES.USER],
    });
}

async function createTestWorkspace(customOwner) {
    const wsOwner = customOwner || owner;
    return Workspace.create({
        name: "Test Workspace",
        slug: new Types.ObjectId().toString(),
        ownerId: wsOwner._id,
        status: "ACTIVE",
    });
}

async function addMember(ws, u, roleCode) {
    return Member.create({
        workspaceId: ws._id,
        userId: u._id,
        roleId: roles[roleCode],
        status: "ACTIVE",
    });
}

async function apiRequest(method, path, actor, body) {
    const response = await fetch(url + path, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(actor ? { Authorization: `Bearer ${actor._id}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
}

test("1. Create custom role: validates workspace, enforces unique code and name in workspace", async () => {
    const ws = await createTestWorkspace();
    const permissions = await Permission.find({
        code: { $in: ["NOTES_READ", "NOTES_CREATE"] },
    })
        .select("_id")
        .lean();

    const payload = {
        name: "Developer",
        displayName: "Software Developer",
        code: "DEV_ROLE",
        workspaceId: String(ws._id),
        permissions: permissions.map((p) => String(p._id)),
        priority: 30,
    };

    const res = await apiRequest("POST", "/roles/create", owner, payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, "developer");
    assert.equal(res.body.data.code, "DEV_ROLE");
    assert.equal(res.body.data.workspaceId, String(ws._id));

    // Duplicate code in same workspace rejected
    const dupCode = await apiRequest("POST", "/roles/create", owner, {
        ...payload,
        name: "Different Name",
    });
    assert.equal(dupCode.status, 409);

    // Duplicate name in same workspace rejected
    const dupName = await apiRequest("POST", "/roles/create", owner, {
        ...payload,
        code: "ANOTHER_CODE",
    });
    assert.equal(dupName.status, 409);
});

test("2. Workspace isolation: same role code and name allowed in different workspace", async () => {
    const wsA = await createTestWorkspace();
    const wsB = await createTestWorkspace();

    const payloadA = {
        name: "Designer",
        displayName: "UI Designer",
        code: "DESIGNER",
        workspaceId: String(wsA._id),
        priority: 25,
    };
    const resA = await apiRequest("POST", "/roles/create", owner, payloadA);
    assert.equal(resA.status, 201);

    const payloadB = {
        name: "Designer",
        displayName: "UI Designer",
        code: "DESIGNER",
        workspaceId: String(wsB._id),
        priority: 25,
    };
    const resB = await apiRequest("POST", "/roles/create", owner, payloadB);
    assert.equal(resB.status, 201);
});

test("3. System role protection: cannot create role with protected system code, cannot delete or modify system roles", async () => {
    const ws = await createTestWorkspace();

    // Reject creating role with protected code
    const res = await apiRequest("POST", "/roles/create", owner, {
        name: "Super Admin Clone",
        displayName: "Fake Admin",
        code: SYSTEM_ROLE_CODES.SUPER_ADMIN,
        workspaceId: String(ws._id),
    });
    assert.equal(res.status, 403);

    // Reject modifying system role
    const updateRes = await apiRequest(
        "PUT",
        `/roles/update/${roles[SYSTEM_ROLE_CODES.WORKSPACE_ADMIN]}`,
        owner,
        {
            displayName: "Hacked Admin",
        },
    );
    assert.equal(updateRes.status, 403);

    // Reject deleting system role
    const deleteRes = await apiRequest(
        "DELETE",
        `/roles/delete/${roles[SYSTEM_ROLE_CODES.WORKSPACE_MEMBER]}`,
        owner,
    );
    assert.equal(deleteRes.status, 403);

    // Reject changing system role status
    const statusRes = await apiRequest(
        "PATCH",
        `/roles/update/${roles[SYSTEM_ROLE_CODES.WORKSPACE_VIEWER]}/status`,
        owner,
        {
            isActive: false,
        },
    );
    assert.equal(statusRes.status, 403);
});

test("4. Cross-workspace isolation: user in Workspace A cannot access, edit, or delete role in Workspace B", async () => {
    const wsA = await createTestWorkspace();
    const wsB = await createTestWorkspace();

    await addMember(wsA, adminUser, SYSTEM_ROLE_CODES.WORKSPACE_ADMIN);
    // adminUser is only a member of wsA, not wsB

    const createB = await apiRequest("POST", "/roles/create", owner, {
        name: "Secret Role",
        displayName: "Secret Role",
        code: "SECRET_ROLE",
        workspaceId: String(wsB._id),
    });
    assert.equal(createB.status, 201);
    const roleBId = createB.body.data._id;

    // adminUser cannot get role from wsB
    const getRes = await apiRequest("GET", `/roles/get/${roleBId}`, adminUser);
    assert.equal(getRes.status, 403);

    // adminUser cannot update role from wsB
    const updateRes = await apiRequest("PUT", `/roles/update/${roleBId}`, adminUser, {
        displayName: "Cross Workspace Injection",
    });
    assert.equal(updateRes.status, 403);

    // adminUser cannot delete role from wsB
    const deleteRes = await apiRequest("DELETE", `/roles/delete/${roleBId}`, adminUser);
    assert.equal(deleteRes.status, 403);
});

test("5. Privilege escalation prevention: administrator cannot create role with higher or equal priority", async () => {
    const ws = await createTestWorkspace();
    await addMember(ws, adminUser, SYSTEM_ROLE_CODES.WORKSPACE_ADMIN);
    // WORKSPACE_ADMIN priority is 80

    // Attempt to create role with priority 85 (higher than admin's 80)
    const resHigher = await apiRequest("POST", "/roles/create", adminUser, {
        name: "Super Boss",
        displayName: "Super Boss",
        code: "SUPER_BOSS",
        workspaceId: String(ws._id),
        priority: 85,
    });
    assert.equal(resHigher.status, 403);

    // Attempt to create role with priority 80 (equal to admin's 80)
    const resEqual = await apiRequest("POST", "/roles/create", adminUser, {
        name: "Co Boss",
        displayName: "Co Boss",
        code: "CO_BOSS",
        workspaceId: String(ws._id),
        priority: 80,
    });
    assert.equal(resEqual.status, 403);

    // Lower priority (70) succeeds
    const resLower = await apiRequest("POST", "/roles/create", adminUser, {
        name: "Team Lead",
        displayName: "Team Lead",
        code: "TEAM_LEAD",
        workspaceId: String(ws._id),
        priority: 70,
    });
    assert.equal(resLower.status, 201);
});

test("6. Privilege escalation prevention: cannot grant permissions caller does not have or owner-only permissions", async () => {
    const ws = await createTestWorkspace();
    await addMember(ws, adminUser, SYSTEM_ROLE_CODES.WORKSPACE_ADMIN);

    const ownerTransferPerm = await Permission.findOne({ code: "WORKSPACE_TRANSFER_OWNERSHIP" }).lean();
    assert.ok(ownerTransferPerm);

    // Even owner cannot grant transfer ownership to a custom role
    const resTransfer = await apiRequest("POST", "/roles/create", owner, {
        name: "Owner Imposter",
        displayName: "Owner Imposter",
        code: "OWNER_IMPOSTER",
        workspaceId: String(ws._id),
        permissions: [String(ownerTransferPerm._id)],
    });
    assert.equal(resTransfer.status, 403);
});

test("7. Self-escalation prevention: member cannot edit their own assigned role", async () => {
    const ws = await createTestWorkspace();

    const customRoleRes = await apiRequest("POST", "/roles/create", owner, {
        name: "Custom Dev",
        displayName: "Custom Dev",
        code: "CUSTOM_DEV",
        workspaceId: String(ws._id),
        priority: 40,
    });
    assert.equal(customRoleRes.status, 201);
    const customRoleId = customRoleRes.body.data._id;

    // Assign custom role to adminUser
    await Member.create({
        workspaceId: ws._id,
        userId: adminUser._id,
        roleId: new Types.ObjectId(customRoleId),
        status: "ACTIVE",
    });

    // adminUser tries to modify their own assigned custom role
    const res = await apiRequest("PUT", `/roles/update/${customRoleId}`, adminUser, {
        displayName: "Escalated Dev",
    });
    assert.equal(res.status, 403);
});

test("8. Safe deletion: reject deleting role assigned to active members or referenced in pending invitations", async () => {
    const ws = await createTestWorkspace();

    const roleRes = await apiRequest("POST", "/roles/create", owner, {
        name: "Assigned Role",
        displayName: "Assigned Role",
        code: "ASSIGNED_ROLE",
        workspaceId: String(ws._id),
        priority: 20,
    });
    assert.equal(roleRes.status, 201);
    const roleId = roleRes.body.data._id;

    // Assign member
    const member = await Member.create({
        workspaceId: ws._id,
        userId: regularMember._id,
        roleId: new Types.ObjectId(roleId),
        status: "ACTIVE",
    });

    // Reject delete because member is assigned
    const deleteRes1 = await apiRequest("DELETE", `/roles/delete/${roleId}`, owner);
    assert.equal(deleteRes1.status, 409);

    // Remove member
    await Member.deleteOne({ _id: member._id });

    // Create pending invitation referencing this role
    const invitation = await Invitation.create({
        workspaceId: ws._id,
        email: "invitee@example.test",
        roleId: new Types.ObjectId(roleId),
        invitedBy: owner._id,
        tokenHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 86400000),
        status: "PENDING",
    });

    // Reject delete because invitation is pending
    const deleteRes2 = await apiRequest("DELETE", `/roles/delete/${roleId}`, owner);
    assert.equal(deleteRes2.status, 409);

    // Cancel invitation
    await Invitation.deleteOne({ _id: invitation._id });

    // Deletion now succeeds
    const deleteRes3 = await apiRequest("DELETE", `/roles/delete/${roleId}`, owner);
    assert.equal(deleteRes3.status, 200);
});

test("9. Safe deactivation: reject deactivating default roles", async () => {
    // Attempting to deactivate WORKSPACE_MEMBER (which is isDefault: true)
    const memberRoleId = roles[SYSTEM_ROLE_CODES.WORKSPACE_MEMBER];
    const res = await apiRequest("PATCH", `/roles/update/${memberRoleId}/status`, owner, {
        isActive: false,
    });
    assert.equal(res.status, 403); // Protected system role
});

test("10. List roles: paginated, workspace isolation, lean selective projections", async () => {
    const ws = await createTestWorkspace();

    const res = await apiRequest("GET", `/roles/getall?workspaceId=${ws._id}&limit=5`, owner);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.ok(res.body.meta.total >= 4); // System roles (OWNER, ADMIN, MEMBER, VIEWER)
    assert.equal(res.body.meta.limit, 5);

    // Verify row has selective fields
    const row = res.body.data[0];
    assert.ok("name" in row);
    assert.ok("code" in row);
    assert.ok("priority" in row);
});

test("11. Update role permissions: idempotent update skips audit when permissions array unchanged", async () => {
    const ws = await createTestWorkspace();
    const perm = await Permission.findOne({ code: "NOTES_READ" }).lean();

    const roleRes = await apiRequest("POST", "/roles/create", owner, {
        name: "Permission Role",
        displayName: "Permission Role",
        code: "PERM_ROLE",
        workspaceId: String(ws._id),
        permissions: [String(perm._id)],
    });
    assert.equal(roleRes.status, 201);
    const roleId = roleRes.body.data._id;

    const initialAuditCount = await Audit.countDocuments({ resourceId: new Types.ObjectId(roleId) });

    // Send exact same permission
    const updateRes = await apiRequest("PUT", `/roles/update/${roleId}`, owner, {
        permissions: [String(perm._id)],
    });
    assert.equal(updateRes.status, 200);

    const finalAuditCount = await Audit.countDocuments({ resourceId: new Types.ObjectId(roleId) });
    // No new audit entry because permissions were unchanged
    assert.equal(finalAuditCount, initialAuditCount);
});

test("12. Permissions: list permissions, get by ID, get by code, grouped permissions", async () => {
    const listRes = await apiRequest("GET", "/permissions/getall?limit=10", owner);
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.data.length > 0);
    assert.ok(listRes.body.meta);

    const sample = listRes.body.data[0];
    const byIdRes = await apiRequest("GET", `/permissions/get/${sample._id}`, owner);
    assert.equal(byIdRes.status, 200);
    assert.equal(byIdRes.body.data.code, sample.code);

    const byCodeRes = await apiRequest("GET", `/permissions/get/code/${sample.code}`, owner);
    assert.equal(byCodeRes.status, 200);
    assert.equal(byCodeRes.body.data._id, sample._id);

    const groupedRes = await apiRequest("GET", "/permissions/grouped", owner);
    assert.equal(groupedRes.status, 200);
    assert.ok(Array.isArray(groupedRes.body.data));
    assert.ok(groupedRes.body.data.some((g) => g.module === "WORKSPACE"));
});

test("13. Permissions mutations: system permissions are strictly immutable and protected", async () => {
    const sysPerm = await Permission.findOne({ isSystem: true }).lean();
    assert.ok(sysPerm);

    // Attempt update system permission
    const updateRes = await apiRequest("PUT", `/permissions/update/${sysPerm._id}`, superAdminUser, {
        displayName: "Modified Permission",
    });
    assert.equal(updateRes.status, 403);

    // Attempt delete system permission
    const deleteRes = await apiRequest("DELETE", `/permissions/delete/${sysPerm._id}`, superAdminUser);
    assert.equal(deleteRes.status, 403);

    // Attempt deactivate system permission
    const statusRes = await apiRequest("PATCH", `/permissions/update/${sysPerm._id}/status`, superAdminUser, {
        isActive: false,
    });
    assert.equal(statusRes.status, 403);
});

test("14. Permissions mutations: regular user cannot create or modify permissions", async () => {
    const res = await apiRequest("POST", "/permissions/create", owner, {
        name: "unauthorized_perm",
        displayName: "Unauthorized",
        code: "UNAUTHORIZED_PERM",
        module: "CUSTOM",
        action: "READ",
    });
    assert.equal(res.status, 403);
});

test("15. Audit logging: successful role operations produce audit records with actor and workspace context", async () => {
    const ws = await createTestWorkspace();

    const roleRes = await apiRequest("POST", "/roles/create", owner, {
        name: "Audit Test Role",
        displayName: "Audit Test Role",
        code: "AUDIT_TEST_ROLE",
        workspaceId: String(ws._id),
    });
    assert.equal(roleRes.status, 201);
    const roleId = roleRes.body.data._id;

    const createAudit = await Audit.findOne({
        resourceId: roleId,
        action: "CREATE",
    }).lean();

    assert.ok(createAudit);
    assert.equal(String(createAudit.actorId), String(owner._id));
    assert.equal(String(createAudit.metadata?.workspaceId), String(ws._id));

    // Update status
    await apiRequest("PATCH", `/roles/update/${roleId}/status`, owner, {
        isActive: false,
    });

    const statusAudit = await Audit.findOne({
        resourceId: roleId,
        action: "STATUS_CHANGE",
    }).lean();
    assert.ok(statusAudit);
    assert.equal(statusAudit.changes[0].field, "isActive");
    assert.equal(statusAudit.changes[0].oldValue, true);
    assert.equal(statusAudit.changes[0].newValue, false);
});

test("16. Fail-closed audit policy: failure in audit logging rolls back role creation", async () => {
    const ws = await createTestWorkspace();

    // Mock auditLogService.logCreate to throw an error
    const originalLogCreate = AuditLogService.prototype.logCreate;
    AuditLogService.prototype.logCreate = async () => {
        throw new Error("Simulated Audit Logging Database Failure");
    };

    try {
        const res = await apiRequest("POST", "/roles/create", owner, {
            name: "Rollback Role",
            displayName: "Rollback Role",
            code: "ROLLBACK_ROLE",
            workspaceId: String(ws._id),
        });

        // The request should fail because audit logging failed
        assert.equal(res.status, 500);

        // Verify the role was rolled back (does not exist in database)
        const exists = await Role.exists({ code: "ROLLBACK_ROLE", workspaceId: ws._id });
        assert.equal(exists, null);
    } finally {
        AuditLogService.prototype.logCreate = originalLogCreate;
    }
});

test("17. Shared role validation: assertAssignableWorkspaceRole rejects inactive, cross-workspace or owner roles", async () => {
    const wsA = await createTestWorkspace();
    const wsB = await createTestWorkspace();

    // Owner role cannot be assigned as a workspace member role
    assert.throws(
        () =>
            permissionAuthorizationService.assertAssignableWorkspaceRole(
                { code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER, scope: RoleScope.WORKSPACE, isActive: true },
                String(wsA._id),
            ),
        (err) => err.statusCode === 400,
    );

    // Cross-workspace role cannot be assigned
    assert.throws(
        () =>
            permissionAuthorizationService.assertAssignableWorkspaceRole(
                { code: "CUSTOM", scope: RoleScope.WORKSPACE, isActive: true, workspaceId: wsB._id },
                String(wsA._id),
            ),
        (err) => err.statusCode === 400,
    );

    // Inactive role cannot be assigned
    assert.throws(
        () =>
            permissionAuthorizationService.assertAssignableWorkspaceRole(
                { code: "CUSTOM", scope: RoleScope.WORKSPACE, isActive: false, workspaceId: wsA._id },
                String(wsA._id),
            ),
        (err) => err.statusCode === 400,
    );
});
