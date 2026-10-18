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
import { UserModel } from "../src/modules/user/models/user.model.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { UserSubscriptionModel as Subscription } from "../src/modules/usersubscription/models/usersubscription.model.ts";
import { UserSubscriptionService } from "../src/modules/usersubscription/services/usersubscription.service.ts";
import { UserSubscriptionRepository } from "../src/modules/usersubscription/repositories/usersubscription.repository.ts";
import { UserSubscriptionValidation } from "../src/modules/usersubscription/validations/usersubscription.validation.ts";
import { AuditLogModel } from "../src/modules/auditlog/models/auditLog.model.ts";
import { AuditLogService } from "../src/modules/auditlog/services/auditLog.service.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "subscription-test-secret";
process.env.JWT_REFRESH_SECRET = "subscription-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: routes } = await import("../src/modules/usersubscription/routes/usersubscription.routes.ts");

const service = new UserSubscriptionService();
const repository = new UserSubscriptionRepository();
let mongo, directory, server, url, free, pro, team, monthly, yearly, teamPrice, admin, owner, stranger;
const currencyId = new Types.ObjectId();

async function account(status = "ACTIVE", roleId = new Types.ObjectId()) {
    const row = await UserModel.create({
        email: new Types.ObjectId() + "@subscription.test",
        globalRoleId: roleId, status, isDeleted: false,
    });
    return row._id.toString();
}

async function paid(user, changes = {}) {
    return Subscription.create({
        user, plan: pro._id, planPriceId: monthly._id, billingInterval: "MONTHLY",
        status: "active", isActive: true, startDate: new Date("2025-01-01"),
        endDate: new Date(Date.now() + 86_400_000),
        currentPeriodStart: new Date("2025-01-01"),
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
        autoRenew: true,
        ...changes,
    });
}

async function request(path, { body, user = owner, method = body === undefined ? "GET" : "POST" } = {}) {
    const response = await fetch(url + path, {
        method,
        headers: { ...(user ? { Authorization: "Bearer " + user } : {}), "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text.startsWith("{") ? JSON.parse(text) : text };
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    directory = await mkdtemp(join(tmpdir(), "subscription-test-"));
    mongo = spawn(process.env.MONGOD_BINARY ?? "mongod", [
        "--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1",
        "--logpath", join(directory, "mongo.log"),
    ], { windowsHide: true, stdio: "ignore" });
    let startupError;
    mongo.on("error", error => { startupError = error; });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect("mongodb://127.0.0.1:" + port + "/subscription_test", {
                serverSelectionTimeoutMS: 500, autoIndex: false,
            });
            break;
        } catch (error) {
            if (attempt >= 40) throw error;
            await delay(250);
        }
    }
    await Subscription.createIndexes();
    free = await PlanModel.create({ name: "Free", code: "FREE", type: "FREE", description: "Free", isActive: true, visibility: "PUBLIC", pricingModel: "FIXED" });
    pro = await PlanModel.create({ name: "Pro", code: "PRO", type: "PAID", description: "Pro", isActive: true, visibility: "PUBLIC", pricingModel: "FIXED" });
    team = await PlanModel.create({ name: "Team", code: "TEAM", type: "PAID", description: "Team", isActive: true, visibility: "PUBLIC", pricingModel: "FIXED" });
    monthly = await PlanPriceModel.create({ planId: pro._id, currencyId, billingInterval: "MONTHLY", amountMinor: 12345, isActive: true });
    yearly = await PlanPriceModel.create({ planId: pro._id, currencyId, billingInterval: "YEARLY", amountMinor: 98765, isActive: true });
    teamPrice = await PlanPriceModel.create({ planId: team._id, currencyId, billingInterval: "MONTHLY", amountMinor: 22222, isActive: true });
    const permissions = await PermissionModel.create(["READ", "MANAGE"].map(action => ({
        name: "subscription_" + action.toLowerCase(), displayName: action, code: "SUBSCRIPTION_" + action,
        module: "USER_SUBSCRIPTION", action, access: "ANY", isActive: true,
    })));
    const role = await RoleModel.create({ name: "subscription_admin", displayName: "Subscription admin",
        code: "SUBSCRIPTION_ADMIN", scope: "GLOBAL", workspaceId: null, isActive: true, permissions: permissions.map(row => row._id) });
    admin = await account("ACTIVE", role._id);
    owner = await account();
    stranger = await account();
    mock.method(JwtUtil, "verifyAccessToken", token => ({ sub: token, sessionId: "test" }));
    const app = express();
    app.use(express.json());
    app.use("/usersubscription", routes);
    app.use(errorMiddleware);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = "http://127.0.0.1:" + server.address().port + "/usersubscription";
});

after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    mock.restoreAll();
    await mongoose.disconnect();
    if (mongo?.pid && mongo.exitCode === null) {
        const exited = once(mongo, "exit");
        mongo.kill();
        await exited;
    }
    if (directory) {
        const target = resolve(directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("subscription-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("Free initialization is concurrent, idempotent, non-expiring, provider independent and audited", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => service.ensureFreeSubscription(owner)));
    assert.equal(new Set(results.map(row => String(row._id))).size, 1);
    assert.equal(await Subscription.countDocuments({ user: owner }), 1);
    assert.equal(results[0].endDate, null);
    assert.equal(results[0].planPriceId, null);
    assert.equal(results[0].status, "active");
    assert.ok(!("auditOutbox" in results[0]));
    assert.equal(await AuditLogModel.countDocuments({ resourceId: results[0]._id, action: "CREATE" }), 1);
});

test("GET fallback is read-only and does not initialize Free rows", async () => {
    for (let i = 0; i < 3; i++) {
        const result = await service.getCurrentSubscription(stranger);
        assert.equal(result.subscription, null);
        assert.equal(result.effectivePlan.code, "FREE");
    }
    assert.equal(await Subscription.countDocuments({ user: stranger }), 0);
});

test("Free provisioning preserves a current paid subscription", async () => {
    const user = await account();
    const row = await paid(user);
    const result = await service.ensureFreeSubscription(user);
    assert.equal(String(result._id), String(row._id));
    assert.equal(String(result.plan), String(pro._id));
});

test("owner-scoped detail/list APIs deny unauthenticated and cross-user access", async () => {
    const row = await service.ensureFreeSubscription(owner);
    assert.equal((await request("/current", { user: null })).status, 401);
    assert.equal((await request("/get/" + row._id, { user: stranger })).status, 404);
    assert.equal((await request("/get/not-an-id")).status, 400);
    assert.equal((await request("/getall", { user: stranger })).body.meta.total, 0);
    assert.equal((await request("/getall?user=" + owner, { user: stranger })).status, 400);
    assert.equal((await request("/cancel", { user: stranger, body: { user: owner } })).status, 400);
});

test("inactive accounts cannot request, cancel or undo changes; registration supports pending accounts", async () => {
    const user = await account("PENDING");
    await service.ensureFreeSubscription(user);
    for (const path of ["/change-plan", "/cancel", "/undo-cancel"]) {
        const body = path === "/change-plan" ? { plan: String(free._id) } : {};
        assert.equal((await request(path, { user, body })).status, 403);
    }
    await UserModel.updateOne({ _id: user }, { status: "SUSPENDED" });
    await assert.rejects(service.ensureFreeSubscription(user), error => error.statusCode === 403);
});

test("plan selection validates existence, personal eligibility, active state, price and interval", async () => {
    const cases = [
        { plan: String(new Types.ObjectId()) },
        { plan: String(team._id), planPriceId: String(teamPrice._id), billingInterval: "MONTHLY" },
        { plan: String(pro._id) },
        { plan: String(pro._id), planPriceId: String(teamPrice._id), billingInterval: "MONTHLY" },
        { plan: String(pro._id), planPriceId: String(monthly._id), billingInterval: "YEARLY" },
        { plan: String(pro._id), planPriceId: String(new Types.ObjectId()), billingInterval: "MONTHLY" },
        { plan: String(free._id), planPriceId: String(monthly._id) },
    ];
    for (const body of cases) assert.equal((await request("/change-plan", { body })).status, 422);
    await PlanPriceModel.updateOne({ _id: monthly._id }, { isActive: false });
    assert.equal((await request("/change-plan", { body: { plan: String(pro._id), planPriceId: String(monthly._id), billingInterval: "MONTHLY" } })).status, 422);
    await PlanPriceModel.updateOne({ _id: monthly._id }, { isActive: true });
    await PlanModel.updateOne({ _id: pro._id }, { isActive: false });
    assert.equal((await request("/change-plan", { body: { plan: String(pro._id), planPriceId: String(monthly._id), billingInterval: "MONTHLY" } })).status, 422);
    await PlanModel.updateOne({ _id: pro._id }, { isActive: true });
});

test("paid changes stay pending, duplicate requests are idempotent and no provider is needed", async () => {
    const body = { plan: String(pro._id), planPriceId: String(monthly._id), billingInterval: "MONTHLY" };
    const first = await request("/change-plan", { body });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.plan, String(free._id));
    assert.equal(first.body.data.pendingChange.status, "pending_payment");
    const second = await request("/change-plan", { body });
    assert.equal(second.body.data.revision, first.body.data.revision);
    assert.equal(second.body.data.pendingChange.requestId, first.body.data.pendingChange.requestId);
    assert.equal(await Subscription.countDocuments({ user: owner }), 1);
    assert.equal((await service.getCurrentSubscription(owner)).effectivePlan.code, "FREE");
});

test("mass assignment and all client paid activation paths are rejected", async () => {
    for (const key of ["status", "providerSubscriptionId", "paidAt", "currentPeriodEnd", "user"]) {
        assert.equal((await request("/change-plan", { body: { plan: String(pro._id), [key]: "active" } })).status, 400);
    }
    assert.equal((await request("/activate/" + new Types.ObjectId(), { body: {}, method: "PUT" })).status, 404);
    assert.equal((await request("/delete/" + new Types.ObjectId(), { method: "DELETE" })).status, 404);
    await assert.rejects(service.applyVerifiedBillingEvent(), error => error.statusCode === 503);
});

test("canceling an incomplete paid request preserves Free access", async () => {
    const result = await request("/cancel", { body: { reason: "Abandoned checkout" } });
    assert.equal(result.status, 200);
    assert.equal(result.body.data.pendingChange, null);
    assert.equal(result.body.data.status, "active");
    assert.equal(result.body.data.endDate, null);
    assert.equal((await request("/cancel", { body: {} })).status, 200);
});

test("paid cancellation preserves period and undo restores the previous renewal preference", async () => {
    const user = await account();
    const row = await paid(user, { autoRenew: false });
    const first = await request("/cancel", { user, body: { reason: "Not renewing" } });
    assert.equal(first.status, 200);
    assert.equal(first.body.data.status, "active");
    assert.equal(first.body.data.canceledAt, null);
    assert.equal(first.body.data.cancelAtPeriodEnd, true);
    assert.equal(first.body.data.currentPeriodEnd, row.currentPeriodEnd.toISOString());
    assert.equal((await service.getCurrentSubscription(user)).effectivePlan.code, "PRO");
    const repeat = await request("/cancel", { user, body: {} });
    assert.equal(repeat.body.data.revision, first.body.data.revision);
    const undo = await request("/undo-cancel", { user, body: {} });
    assert.equal(undo.body.data.cancelAtPeriodEnd, false);
    assert.equal(undo.body.data.autoRenew, false);
    assert.equal((await request("/undo-cancel", { user, body: {} })).body.data.revision, undo.body.data.revision);
});

test("Free downgrade is scheduled without overwriting the paid plan or period", async () => {
    const user = await account();
    const row = await paid(user);
    const result = await service.requestPlanChange(user, { plan: String(free._id) });
    assert.equal(String(result.plan), String(pro._id));
    assert.equal(result.pendingChange.status, "scheduled");
    assert.equal(+result.pendingChange.effectiveAt, +row.currentPeriodEnd);
    assert.equal(result.cancelAtPeriodEnd, true);
    await service.undoScheduledCancellation(user);
    assert.equal((await repository.findCurrentByUser(user)).pendingChange, null);
});

test("unique current and partial provider indexes reject conflicts but allow null provider references", async () => {
    await assert.rejects(paid(owner), error => error.code === 11000);
    const a = await account(), b = await account(), c = await account();
    await paid(a, { paymentProvider: "example", providerSubscriptionId: "same-ref" });
    await assert.rejects(paid(b, { paymentProvider: "example", providerSubscriptionId: "same-ref" }), error => error.code === 11000);
    await paid(b);
    await paid(c);
});

test("period boundaries preserve reconciliation delay without claiming paid access", async () => {
    const user = await account();
    const end = new Date(Date.now() - 1_000);
    const row = await paid(user, { endDate: end, currentPeriodEnd: end });
    const current = await service.getCurrentSubscription(user);
    assert.equal(current.effectivePlan.code, "FREE");
    assert.equal(current.accessState, "awaiting_reconciliation");
    const due = await repository.findDue(new Date(), 500);
    assert.ok(!due.some(item => String(item._id) === String(row._id)));
    await assert.rejects(service.undoScheduledCancellation(user), error => error.statusCode === 409);
});

test("reconciliation distinguishes cancellation and expiry, retains history, is repeatable and bounded", async () => {
    const canceledUser = await account(), expiredUser = await account();
    const end = new Date(Date.now() - 3 * 86_400_000);
    const canceled = await paid(canceledUser, { endDate: end, currentPeriodEnd: end, cancelAtPeriodEnd: true, cancellationEffectiveAt: end });
    const expired = await paid(expiredUser, { endDate: end, currentPeriodEnd: end });
    const first = await service.reconcileExpiredSubscriptions(1);
    assert.equal(first.scanned, 1);
    assert.equal(first.updated, 1);
    assert.ok(first.nextCursor);
    await service.reconcileExpiredSubscriptions(500, first.nextCursor);
    assert.equal((await Subscription.findById(canceled._id)).status, "cancelled");
    assert.equal((await Subscription.findById(expired._id)).status, "expired");
    assert.equal((await service.reconcileExpiredSubscriptions()).updated, 0);
    assert.equal((await service.getSubscriptionHistory(canceledUser)).data.length, 1);
    assert.equal((await service.getCurrentSubscription(canceledUser)).effectivePlan.code, "FREE");
    await assert.rejects(service.requestCancellation(expiredUser), error => error.statusCode === 404);
});

test("stale concurrent mutations cannot overwrite a newer subscription revision", async () => {
    const user = await account();
    await paid(user);
    const stale = await repository.findCurrentByUser(user);
    await service.requestCancellation(user, { reason: "First writer" });
    const event = { _id: new Types.ObjectId(), actorId: new Types.ObjectId(user), actorType: "USER",
        action: "UPDATE", reason: "Stale writer", before: {}, after: {}, occurredAt: new Date(), requestId: null };
    assert.equal(await repository.compareAndSet(stale, { autoRenew: true }, event), null);
    assert.equal((await repository.findCurrentByUser(user)).autoRenew, false);
});

test("reconciliation does not overwrite a renewed period after its batch read", async () => {
    const user = await account();
    const end = new Date(Date.now() - 3 * 86_400_000);
    const row = await paid(user, { endDate: end, currentPeriodEnd: end });
    const original = UserSubscriptionRepository.prototype.findDue;
    const intercept = mock.method(UserSubscriptionRepository.prototype, "findDue", async function(...args) {
        const rows = await original.apply(this, args);
        const nextEnd = new Date(Date.now() + 86_400_000);
        await Subscription.updateOne({ _id: row._id }, { $set: { endDate: nextEnd, currentPeriodEnd: nextEnd }, $inc: { revision: 1 } });
        return rows;
    });
    try {
        const result = await service.reconcileExpiredSubscriptions();
        assert.equal(result.conflicts, 1);
        assert.equal((await Subscription.findById(row._id)).status, "active");
    } finally { intercept.mock.restore(); }
});

test("GET and POST lists share filters, sorting, pagination and strict validation", async () => {
    const get = await request("/getall?limit=1&page=1&sortBy=createdAt&sortOrder=asc&status=active");
    const post = await request("/getall", { body: { limit: 1, page: 1, sortBy: "createdAt", sortOrder: "asc", status: "active" } });
    assert.equal(get.status, 200);
    assert.deepEqual(get.body, post.body);
    assert.equal(get.body.data.length, 1);
    assert.equal(get.body.meta.total, 1);
    assert.equal((await request("/getall?page=0")).status, 400);
    assert.equal((await request("/getall?sortBy=providerSubscriptionId")).status, 400);
    assert.equal((await request("/getall?limit=10000")).body.meta.limit, 100);
    assert.equal((await request("/getall?search=%5Bx%5D.*")).body.meta.total, 0);
});

test("admin endpoints require explicit global permissions and a reconciliation reason", async () => {
    assert.equal((await request("/admin/getall")).status, 403);
    const listed = await request("/admin/getall?user=" + owner, { user: admin });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.meta.total, 1);
    assert.equal((await request("/admin/reconcile", { user: admin, body: {} })).status, 400);
    assert.equal((await request("/admin/reconcile", { user: admin, body: { reason: "Support reconciliation" } })).status, 200);
});

test("audit failure preserves a durable intent, retry delivers it without rolling back changes", async () => {
    const user = await account();
    await paid(user);
    const failing = mock.method(AuditLogService.prototype, "log", async () => { throw new Error("audit unavailable"); });
    const result = await service.requestCancellation(user, { reason: "Audit outage" }, { requestId: "request-123" });
    failing.mock.restore();
    const stored = await Subscription.findById(result._id).select("+auditOutbox").lean();
    assert.equal(stored.cancelAtPeriodEnd, true);
    assert.equal(stored.auditOutbox.length, 1);
    await service.flushAuditOutbox();
    assert.equal((await Subscription.findById(result._id).select("+auditOutbox")).auditOutbox.length, 0);
    const audit = await AuditLogModel.findOne({ resourceId: result._id });
    assert.equal(audit.actorId.toString(), user);
    assert.equal(audit.requestId, "request-123");
    assert.equal(audit.changes[0].oldValue.cancelAtPeriodEnd, false);
    assert.equal(audit.changes[0].newValue.cancelAtPeriodEnd, true);
});

test("lifecycle rejects terminal reactivation and inconsistent periods", () => {
    for (const status of ["expired", "cancelled"]) {
        assert.throws(() => UserSubscriptionValidation.assertTransition(status, "active"), /transition/);
    }
    UserSubscriptionValidation.assertTransition("active", "past_due");
    UserSubscriptionValidation.assertTransition("past_due", "active");
    assert.throws(() => UserSubscriptionValidation.assertPeriod({
        startDate: new Date("2026-02-01"), endDate: new Date("2026-01-01"),
        currentPeriodStart: null, currentPeriodEnd: null,
    }), /dates/);
});

test("changing paid interval records new intent without replacing paid access", async () => {
    const user = await account();
    const current = await paid(user);
    const result = await service.requestPlanChange(user, {
        plan: String(pro._id), planPriceId: String(yearly._id), billingInterval: "YEARLY",
    });
    assert.equal(String(result.planPriceId), String(monthly._id));
    assert.equal(result.billingInterval, "MONTHLY");
    assert.equal(result.pendingChange.billingInterval, "YEARLY");
    assert.equal(+result.currentPeriodEnd, +current.currentPeriodEnd);
    assert.equal(result.isActive, true);
    assert.equal(await Subscription.countDocuments({ user }), 1);
});

test("an OWN global permission cannot authorize access to all subscribers", async () => {
    const permission = await PermissionModel.create({
        name: "subscription_read_own", displayName: "Read own", code: "SUBSCRIPTION_READ_OWN",
        module: "USER_SUBSCRIPTION", action: "READ", access: "OWN", isActive: true,
    });
    const role = await RoleModel.create({
        name: "own_subscriptions", displayName: "Own subscriptions", code: "OWN_SUBSCRIPTIONS",
        scope: "GLOBAL", workspaceId: null, isActive: true, permissions: [permission._id],
    });
    const user = await account("ACTIVE", role._id);
    assert.equal((await request("/admin/getall", { user })).status, 403);
});

test("reconciliation continues after a row failure and retries that row on a later sweep", async () => {
    const end = new Date(Date.now() - 3 * 86_400_000);
    const failed = await paid(await account(), { endDate: end, currentPeriodEnd: end });
    const succeeded = await paid(await account(), { endDate: end, currentPeriodEnd: end });
    const original = UserSubscriptionRepository.prototype.compareAndSet;
    const intercept = mock.method(UserSubscriptionRepository.prototype, "compareAndSet", async function(previous, ...args) {
        if (String(previous._id) === String(failed._id)) throw new Error("Transient database failure");
        return original.call(this, previous, ...args);
    });
    try {
        const result = await service.reconcileExpiredSubscriptions();
        assert.ok(result.failed.includes(String(failed._id)));
        assert.equal((await Subscription.findById(succeeded._id)).status, "expired");
    } finally { intercept.mock.restore(); }
    assert.equal((await service.reconcileExpiredSubscriptions()).updated, 1);
    assert.equal((await Subscription.findById(failed._id)).status, "expired");
});

test("an invalid non-expiring paid record never becomes the effective paid plan", async () => {
    const user = await account();
    await paid(user, { endDate: null, currentPeriodEnd: null });
    assert.equal((await service.getCurrentSubscription(user)).effectivePlan.code, "FREE");
});
