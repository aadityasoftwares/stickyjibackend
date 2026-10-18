import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { randomBytes, createHash } from "node:crypto";
import mongoose, { Types } from "mongoose";
import express from "express";
import { WorkspaceMemberInvitationService } from "../src/modules/workspaceInvitations/services/workspaceMemberInvitation.service.ts";
import { WorkspaceMemberInvitationRepository } from "../src/modules/workspaceInvitations/repositories/workspaceMemberInvitation.repository.ts";
import { WorkspaceMemberInvitationModel as Invitation } from "../src/modules/workspaceInvitations/models/workspaceMemberInvitation.model.ts";
import { WorkspaceModel as Workspace } from "../src/modules/workspace/models/workspace.model.ts";
import { WorkspaceMemberModel as Member } from "../src/modules/workspaceMember/models/workspaceMember.model.ts";
import { UserModel as User } from "../src/modules/user/models/user.model.ts";
import { RoleModel as Role } from "../src/modules/roles/models/role.model.ts";
import { AuditLogModel as Audit } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { permissionAuthorizationService as permissions } from "../src/modules/permissions/services/permissionAuthorization.service.ts";
import { seedPermissions } from "../src/modules/permissions/seeders/permission.seeder.ts";
import { seedRoles } from "../src/modules/roles/seeders/role.seeder.ts";
import { smtpTransporter } from "../src/config/emailmailer.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "invitation-test";
process.env.JWT_REFRESH_SECRET = "invitation-test-refresh";
process.env.FRONTEND_URL = "https://example.test";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: routes } =
    await import("../src/modules/workspaceInvitations/routes/workspaceMemberInvitation.routes.ts");
const service = new WorkspaceMemberInvitationService();
const roles = {};
let directory, mongo, server, url, owner, outsider, mail;

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    directory = await mkdtemp(join(tmpdir(), "invitations-test-"));
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
            "invitations",
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/invitations?directConnection=true`, {
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
        replSetInitiate: { _id: "invitations", members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
    });
    for (let attempt = 0; ; attempt++) {
        if ((await mongoose.connection.db.admin().command({ hello: 1 })).isWritablePrimary) break;
        assert.ok(attempt < 80);
        await delay(250);
    }
    for (const model of Object.values(mongoose.models)) await model.createCollection();
    await seedPermissions();
    await seedRoles();
    await Invitation.createIndexes();
    await Member.createIndexes();
    for (const role of await Role.find().lean()) roles[role.code] = role._id;
    owner = await user();
    outsider = await user();
    mail = mock.method(smtpTransporter, "sendMail", async () => ({ messageId: "test", accepted: ["ok"] }));
    mock.method(JwtUtil, "verifyAccessToken", (token) => ({ sub: token, sessionId: "test" }));
    const app = express();
    app.use(express.json());
    app.use(routes);
    app.use(errorMiddleware);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
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
        assert.ok(basename(target).startsWith("invitations-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});
async function user() {
    const id = new Types.ObjectId();
    return User.create({ _id: id, email: `${id}@example.test`, status: "ACTIVE", globalRoleId: roles.USER });
}
async function workspace(extra = {}) {
    return Workspace.create({
        name: "Invitations",
        slug: new Types.ObjectId().toString(),
        ownerId: owner._id,
        ...extra,
    });
}
async function invitation(ws, invitee, extra = {}) {
    const token = randomBytes(32).toString("hex");
    const record = await Invitation.create({
        workspaceId: ws._id,
        email: invitee.email,
        userId: invitee._id,
        roleId: roles.WORKSPACE_MEMBER,
        invitedBy: owner._id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 86400000),
        ...extra,
    });
    return { record, token };
}
async function request(method, path, actor, body) {
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
const fails = (code) => (error) => error.statusCode === code;

test("create single/batch, normalize email, skip duplicates and preserve response shape", async () => {
    const ws = await workspace();
    const invitee = await user();
    const body = {
        workspaceId: String(ws._id),
        email: ` ${invitee.email.toUpperCase()} `,
        roleId: String(roles.WORKSPACE_MEMBER),
    };
    const result = await request("POST", "/create", owner, body);
    assert.equal(result.status, 201);
    assert.equal(result.body.data.email, invitee.email);
    assert.ok(!("tokenHash" in result.body.data));
    assert.equal((await request("POST", "/create", owner, body)).status, 409);
    const batch = await request("POST", "/create", owner, {
        workspaceId: String(ws._id),
        invitations: [
            { email: invitee.email, roleId: String(roles.WORKSPACE_MEMBER) },
            { email: "new@example.test", roleId: String(roles.WORKSPACE_VIEWER) },
        ],
    });
    assert.equal(batch.body.data.summary.created, 1);
    assert.equal(batch.body.data.summary.skipped, 1);
    assert.equal(batch.body.data.summary.emailSent, 1);
    assert.equal(await Audit.countDocuments({ "metadata.workspaceId": String(ws._id) }), 2);
});

test("management authorization, cross-workspace hints and context reuse", async () => {
    const ws = await workspace();
    const { record } = await invitation(ws, await user());
    assert.equal((await request("GET", `/get/${record._id}`, outsider)).status, 403);
    assert.equal((await request("PUT", `/cancel/${record._id}`, outsider)).status, 403);
    assert.equal(
        (await request("GET", `/get/${record._id}?workspaceId=${new Types.ObjectId()}`, owner)).status,
        403,
    );
    const auth = await permissions.resolveWorkspaceAuthorization(String(owner._id), String(ws._id));
    const spy = mock.method(permissions, "resolveWorkspaceAuthorization", async () => {
        throw new Error("Repeated resolution");
    });
    try {
        assert.equal(
            String((await service.getInvitationById(String(record._id), String(owner._id), auth))._id),
            String(record._id),
        );
        await assert.rejects(
            service.getInvitationById(String(record._id), String(outsider._id), auth),
            fails(403),
        );
        await assert.rejects(
            service.getInvitationById(String(record._id), String(owner._id), {
                ...auth,
                workspaceStatus: "SUSPENDED",
            }),
            fails(403),
        );
    } finally {
        spy.mock.restore();
    }
});

test("unscoped lists restrict access, pagination and query validation", async () => {
    const ws = await workspace();
    await invitation(ws, await user());
    await invitation(ws, await user());
    const result = await request("GET", `/getall?workspaceId=${ws._id}&limit=1`, owner);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.length, 1);
    assert.equal(result.body.meta.total, 2);
    assert.equal((await request("GET", "/getall", outsider)).body.meta.total, 0);
    assert.equal((await request("GET", "/getall?page=1.5", owner)).status, 400);
    assert.equal((await request("GET", "/getall?status=INVALID", owner)).status, 400);
});

test("role assignment restrictions and supported update/cancel actions", async () => {
    const ws = await workspace();
    const admin = await user();
    await Member.create({ workspaceId: ws._id, userId: admin._id, roleId: roles.WORKSPACE_ADMIN });
    const { record } = await invitation(ws, await user());
    assert.equal(
        (await request("PUT", `/update/${record._id}`, admin, { roleId: String(roles.WORKSPACE_ADMIN) }))
            .status,
        403,
    );
    assert.equal(
        (await request("PUT", `/update/${record._id}`, owner, { roleId: String(roles.WORKSPACE_OWNER) }))
            .status,
        400,
    );
    const updated = await request("PUT", `/update/${record._id}`, admin, {
        roleId: String(roles.WORKSPACE_VIEWER),
        message: "Hello",
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.message, "Hello");
    assert.equal((await request("PUT", `/cancel/${record._id}`, owner)).status, 200);
    assert.equal((await Invitation.findById(record._id)).status, "CANCELLED");
    assert.equal(await Audit.countDocuments({ "metadata.invitationId": String(record._id) }), 2);
});

test("public preview and signup acceptance preserve token flow", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token, record } = await invitation(ws, invitee, { userId: null });
    const preview = await request("POST", "/validatetoken", null, { token });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.email, invitee.email);
    assert.ok(!JSON.stringify(preview.body).includes("tokenHash"));
    const accepted = await request("POST", "/accept", invitee, { token });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.data.invitationId, String(record._id));
    assert.equal(
        String((await Member.findOne({ workspaceId: ws._id, userId: invitee._id })).roleId),
        String(roles.WORKSPACE_MEMBER),
    );
    await assert.rejects(service.acceptInvitation(token, String(invitee._id)), fails(409));
});

test("wrong identity, expired/revoked/declined invitations and active members are rejected", async () => {
    const ws = await workspace();
    const invitee = await user();
    for (const [extra, code] of [
        [{ status: "CANCELLED" }, 409],
        [{ status: "REJECTED" }, 409],
        [{ expiresAt: new Date(0) }, 410],
    ]) {
        const { record, token } = await invitation(ws, invitee, extra);
        await assert.rejects(service.acceptInvitation(token, String(invitee._id)), fails(code));
        await Invitation.deleteOne({ _id: record._id });
    }
    const { token } = await invitation(ws, invitee);
    await assert.rejects(service.acceptInvitation(token, String(outsider._id)), fails(403));
    await Member.create({ workspaceId: ws._id, userId: invitee._id, roleId: roles.WORKSPACE_VIEWER });
    await assert.rejects(service.acceptInvitation(token, String(invitee._id)), fails(409));
});

for (const status of ["ACTIVE", "ARCHIVED", "INACTIVE", "SUSPENDED", "TRASHED", "DELETED"]) {
    test(`acceptance checks workspace ${status}`, async () => {
        const ws = await workspace({ status });
        const invitee = await user();
        const { token } = await invitation(ws, invitee);
        if (["ACTIVE", "ARCHIVED"].includes(status))
            await service.acceptInvitation(token, String(invitee._id));
        else
            await assert.rejects(
                service.acceptInvitation(token, String(invitee._id)),
                fails(["INACTIVE", "SUSPENDED"].includes(status) ? 403 : 400),
            );
    });
}
test("personal workspaces reject creation and acceptance", async () => {
    const ws = await workspace({ isPersonal: true });
    const invitee = await user();
    const { token } = await invitation(ws, invitee);
    await assert.rejects(service.acceptInvitation(token, String(invitee._id)), fails(400));
    await assert.rejects(
        service.createInvitation(
            { workspaceId: ws._id, email: "another@example.test", roleId: roles.WORKSPACE_MEMBER },
            String(owner._id),
        ),
        fails(400),
    );
});
test("concurrent acceptance creates exactly one membership and audit", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token, record } = await invitation(ws, invitee);
    const results = await Promise.allSettled([
        service.acceptInvitation(token, String(invitee._id)),
        service.acceptInvitation(token, String(invitee._id)),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await Member.countDocuments({ workspaceId: ws._id, userId: invitee._id }), 1);
    assert.equal(await Audit.countDocuments({ "metadata.invitationId": String(record._id) }), 1);
});
test("audit failure rolls back create, acceptance, update and cancel without sending email", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token, record } = await invitation(ws, invitee);
    const calls = mail.mock.callCount();
    const audit = mock.method(AuditLogService.prototype, "logMany", async () => {
        throw new Error("audit unavailable");
    });
    try {
        await assert.rejects(
            service.createInvitation(
                { workspaceId: ws._id, email: "rollback@example.test", roleId: roles.WORKSPACE_MEMBER },
                String(owner._id),
            ),
            /audit unavailable/,
        );
        assert.equal(
            await Invitation.countDocuments({ workspaceId: ws._id, email: "rollback@example.test" }),
            0,
        );
        assert.equal(mail.mock.callCount(), calls);
        await assert.rejects(service.acceptInvitation(token, String(invitee._id)), /audit unavailable/);
        assert.equal(await Member.countDocuments({ workspaceId: ws._id, userId: invitee._id }), 0);
        await assert.rejects(
            service.updateInvitation(String(record._id), { message: "rollback" }, String(owner._id)),
            /audit unavailable/,
        );
        await assert.rejects(
            service.cancelInvitation(String(record._id), String(owner._id)),
            /audit unavailable/,
        );
        const current = await Invitation.findById(record._id);
        assert.equal(current.status, "PENDING");
        assert.equal(current.message, null);
    } finally {
        audit.mock.restore();
    }
});

test("concurrent creation sends one email and creates one audited invitation", async () => {
    const ws = await workspace();
    const invitee = await user();
    const calls = mail.mock.callCount();
    const payload = { workspaceId: ws._id, email: invitee.email, roleId: roles.WORKSPACE_MEMBER };
    const results = await Promise.allSettled([
        service.createInvitation(payload, String(owner._id)),
        service.createInvitation(payload, String(owner._id)),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await Invitation.countDocuments({ workspaceId: ws._id, status: "PENDING" }), 1);
    assert.equal(await Audit.countDocuments({ "metadata.workspaceId": String(ws._id) }), 1);
    assert.equal(mail.mock.callCount() - calls, 1);
});

test("acceptance racing cancellation leaves a consistent lifecycle", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token, record } = await invitation(ws, invitee);
    const results = await Promise.allSettled([
        service.acceptInvitation(token, String(invitee._id)),
        service.cancelInvitation(String(record._id), String(owner._id)),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const current = await Invitation.findById(record._id);
    assert.equal(
        await Member.countDocuments({ workspaceId: ws._id, userId: invitee._id }),
        current.status === "ACCEPTED" ? 1 : 0,
    );
    assert.equal(await Audit.countDocuments({ "metadata.invitationId": String(record._id) }), 1);
});

test("membership activation failure leaves the token pending and produces no audit", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token, record } = await invitation(ws, invitee);
    const mutation = mock.method(
        WorkspaceMemberInvitationRepository.prototype,
        "activateMembership",
        async () => {
            throw new Error("membership unavailable");
        },
    );
    try {
        await assert.rejects(service.acceptInvitation(token, String(invitee._id)), /membership unavailable/);
    } finally {
        mutation.mock.restore();
    }
    assert.equal((await Invitation.findById(record._id)).status, "PENDING");
    assert.equal(await Audit.countDocuments({ "metadata.invitationId": String(record._id) }), 0);
    await service.acceptInvitation(token, String(invitee._id));
});

test("removed membership reactivates and cancelled invitations stay cancelled after restore", async () => {
    const ws = await workspace();
    const invitee = await user();
    const member = await Member.create({
        workspaceId: ws._id,
        userId: invitee._id,
        roleId: roles.WORKSPACE_VIEWER,
        status: "REMOVED",
    });
    const { token } = await invitation(ws, invitee);
    const accepted = await service.acceptInvitation(token, String(invitee._id));
    assert.equal(accepted.memberId, String(member._id));
    const other = await user();
    const cancelled = await invitation(ws, other, { status: "CANCELLED" });
    await Workspace.updateOne({ _id: ws._id }, { status: "TRASHED" });
    await Workspace.updateOne({ _id: ws._id }, { status: "ACTIVE" });
    await assert.rejects(service.acceptInvitation(cancelled.token, String(other._id)), fails(409));
});

test("preview and acceptance query work excludes redundant populations and topology probes", async () => {
    const ws = await workspace();
    const invitee = await user();
    const { token } = await invitation(ws, invitee);
    const operations = [];
    mongoose.set("debug", (collection, method) => operations.push([collection, method]));
    try {
        await service.validateInvitationToken(token);
        assert.equal(operations.length, 7); // invitation, inviter, workspace, role, user, profile, membership
        operations.length = 0;
        await service.acceptInvitation(token, String(invitee._id));
        assert.equal(operations.length, 8); // five reads, invitation update, membership insert, audit insert
        assert.equal(operations.filter(([collection]) => collection === Workspace.collection.name).length, 1);
    } finally {
        mongoose.set("debug", false);
    }
});
