import assert from "node:assert/strict";
import { before, after, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import express from "express";

import { UserModel } from "../src/modules/user/models/user.model.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { CurrencyModel } from "../src/modules/currency/models/currency.model.ts";
import { UserSubscriptionModel } from "../src/modules/usersubscription/models/usersubscription.model.ts";
import { UserSubscriptionService } from "../src/modules/usersubscription/services/usersubscription.service.ts";
import { SubscriptionPaymentModel } from "../src/modules/subscriptionpayment/models/subscriptionpayment.model.ts";
import { SubscriptionPaymentService } from "../src/modules/subscriptionpayment/services/subscriptionpayment.service.ts";
import { BillingPlanMappingModel } from "../src/modules/billing/models/billingplanmapping.model.ts";
import { CheckoutIntentModel } from "../src/modules/billing/models/checkoutintent.model.ts";
import { BillingEventModel } from "../src/modules/billing/models/billingevent.model.ts";
import { BillingService } from "../src/modules/billing/services/billing.service.ts";
import { BillingWebhookService } from "../src/modules/billing/services/billing-webhook.service.ts";
import { BillingReconciliationService } from "../src/modules/billing/services/billing-reconciliation.service.ts";
import { BillingRepository } from "../src/modules/billing/repositories/billing.repository.ts";
import { BillingProviderName, CheckoutIntentStatus, BillingEventProcessingStatus } from "../src/modules/billing/constants/billing.enums.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "billing-test-access-secret";
process.env.JWT_REFRESH_SECRET = "billing-test-refresh-secret";
process.env.RAZORPAY_KEY_ID = "rzp_test_sampleKeyId";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_123456";
process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_super_secret_webhook_key";

const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: billingRoutes } = await import("../src/modules/billing/routes/billing.routes.ts");

let mongo, directory, server, url;
let freePlan, proPlan, currencyINR, proMonthlyPrice, proYearlyPrice, freePrice;
let ownerId, strangerId;

class MockRazorpayProvider {
    constructor() {
        this.plans = new Map();
        this.subscriptions = new Map();
        this.payments = new Map();
        this.createPlanCalls = 0;
        this.createSubscriptionCalls = 0;
        this.cancelSubscriptionCalls = 0;
    }

    async createPlan(input) {
        this.createPlanCalls++;
        const id = "plan_" + new Types.ObjectId();
        const plan = {
            id,
            interval: 1,
            period: input.interval,
            item: {
                id: "item_" + new Types.ObjectId(),
                name: input.name,
                amount: input.amountMinor,
                currency: input.currency,
            },
        };
        this.plans.set(id, plan);
        return plan;
    }

    async getPlan(id) {
        return this.plans.get(id);
    }

    async createSubscription(input) {
        this.createSubscriptionCalls++;
        const id = "sub_" + new Types.ObjectId();
        const now = new Date();
        const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const sub = {
            id,
            planId: input.planId,
            status: "created",
            currentStart: now,
            currentEnd: end,
            chargeAt: end,
            endedAt: null,
            totalCount: input.totalCount,
            paidCount: 0,
            remainingCount: input.totalCount,
            shortUrl: "https://rzp.io/i/" + id,
            notes: input.notes,
        };
        this.subscriptions.set(id, sub);
        return sub;
    }

    async getSubscription(id) {
        const sub = this.subscriptions.get(id);
        if (!sub) throw new Error("Subscription not found: " + id);
        return sub;
    }

    async cancelSubscription(input) {
        this.cancelSubscriptionCalls++;
        const sub = this.subscriptions.get(input.providerSubscriptionId);
        if (sub) {
            sub.status = input.cancelAtCycleEnd ? "active" : "cancelled";
            if (!input.cancelAtCycleEnd) sub.endedAt = new Date();
        }
        return sub;
    }

    async getPayment(id) {
        const payment = this.payments.get(id) || {
            id,
            amountMinor: 9900,
            currency: "INR",
            status: "captured",
            captured: true,
            createdAt: new Date(),
        };
        return payment;
    }

    verifyWebhookSignature(rawBody, signature) {
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(rawBody)
            .digest("hex");
        const expBuf = Buffer.from(expected, "utf8");
        const sigBuf = Buffer.from(signature, "utf8");
        if (expBuf.length !== sigBuf.length) return false;
        return crypto.timingSafeEqual(expBuf, sigBuf);
    }

    verifySubscriptionCheckoutSignature(paymentId, subscriptionId, signature) {
        const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(paymentId + "|" + subscriptionId)
            .digest("hex");
        if (Buffer.from(expected).length !== Buffer.from(signature).length) return false;
        return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
    }
}

let mockProvider;
let billingService;
let webhookService;
let reconciliationService;
let billingRepo;

async function request(path, { body, user = ownerId, method = body === undefined ? "GET" : "POST", headers = {} } = {}) {
    const rawBodyBuffer = body !== undefined ? Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) : undefined;
    const response = await fetch(url + path, {
        method,
        headers: {
            ...(user ? { Authorization: "Bearer " + user } : {}),
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: rawBodyBuffer,
    });
    const text = await response.text();
    return { status: response.status, body: text.startsWith("{") ? JSON.parse(text) : text };
}

before(async () => {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(r => socket.close(r));

    directory = await mkdtemp(join(tmpdir(), "billing-test-"));
    mongo = spawn(process.env.MONGOD_BINARY ?? "mongod", [
        "--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1",
        "--logpath", join(directory, "mongo.log"),
    ], { windowsHide: true, stdio: "ignore" });

    let startupError;
    mongo.on("error", err => { startupError = err; });

    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect("mongodb://127.0.0.1:" + port + "/billing_test", {
                serverSelectionTimeoutMS: 500, autoIndex: false,
            });
            break;
        } catch (err) {
            if (attempt >= 40) throw err;
            await delay(250);
        }
    }

    await UserSubscriptionModel.createIndexes();
    await SubscriptionPaymentModel.createIndexes();
    await BillingPlanMappingModel.createIndexes();
    await CheckoutIntentModel.createIndexes();
    await BillingEventModel.createIndexes();

    mockProvider = new MockRazorpayProvider();
    billingRepo = new BillingRepository();
    const paymentService = new SubscriptionPaymentService();
    const userSubService = new UserSubscriptionService();

    billingService = new BillingService(mockProvider, billingRepo, paymentService, userSubService);
    webhookService = new BillingWebhookService(mockProvider, billingRepo, paymentService, userSubService);
    reconciliationService = new BillingReconciliationService(mockProvider, billingRepo, userSubService, webhookService);

    // Seed Currencies
    currencyINR = await CurrencyModel.create({
        name: "Indian Rupee",
        code: "INR",
        symbol: "₹",
        numericCode: "356",
        decimalPlaces: 2,
        isActive: true,
    });

    // Seed Plans
    freePlan = await PlanModel.create({
        name: "Free", code: "FREE", type: "FREE", description: "Free plan",
        isActive: true, visibility: "PUBLIC", pricingModel: "FIXED",
    });
    proPlan = await PlanModel.create({
        name: "Pro", code: "PRO", type: "PAID", description: "Pro plan",
        isActive: true, visibility: "PUBLIC", pricingModel: "FIXED",
    });

    // Seed PlanPrices (freePrice tests that even if a price exists pointing to a FREE plan, checkout is rejected)
    freePrice = await PlanPriceModel.create({
        planId: freePlan._id, currencyId: currencyINR._id, billingInterval: "MONTHLY", amountMinor: 100, isActive: true,
    });
    proMonthlyPrice = await PlanPriceModel.create({
        planId: proPlan._id, currencyId: currencyINR._id, billingInterval: "MONTHLY", amountMinor: 9900, isActive: true,
    });
    proYearlyPrice = await PlanPriceModel.create({
        planId: proPlan._id, currencyId: currencyINR._id, billingInterval: "YEARLY", amountMinor: 99000, isActive: true,
    });

    const ownerUser = await UserModel.create({
        email: "owner@test.com", status: "ACTIVE", isDeleted: false, globalRoleId: new Types.ObjectId(),
    });
    ownerId = ownerUser._id.toString();

    const strangerUser = await UserModel.create({
        email: "stranger@test.com", status: "ACTIVE", isDeleted: false, globalRoleId: new Types.ObjectId(),
    });
    strangerId = strangerUser._id.toString();

    // Default owner has active free subscription
    await UserSubscriptionModel.create({
        user: ownerUser._id, plan: freePlan._id, status: "active", isActive: true,
        startDate: new Date(), autoRenew: true,
    });

    mock.method(JwtUtil, "verifyAccessToken", token => ({ sub: token, sessionId: "test-session" }));

    const app = express();
    app.use(express.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    }));
    app.use(express.urlencoded({ extended: true }));

    // Inject our mocked services into routes
    const { BillingController } = await import("../src/modules/billing/controllers/billing.controller.ts");
    const testController = new BillingController();
    testController.billingService = billingService;
    testController.webhookService = webhookService;
    testController.reconciliationService = reconciliationService;

    // Build test router
    const { Router } = await import("express");
    const { authMiddleware } = await import("../src/middlewares/authmiddleware/auth.middleware.ts");
    const r = Router();
    r.get("/plans", testController.getPlans);
    r.post("/webhooks/razorpay", testController.handleWebhook);
    r.post("/subscribe", authMiddleware, testController.subscribe);
    r.post("/verify", authMiddleware, testController.verifyCallback);
    r.get("/current", authMiddleware, testController.getCurrent);
    r.post("/cancel", authMiddleware, testController.cancel);
    r.post("/change-plan", authMiddleware, testController.changePlan);
    r.get("/history", authMiddleware, testController.getHistory);

    app.use("/billing", r);
    app.use(errorMiddleware);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    url = "http://127.0.0.1:" + server.address().port + "/billing";
});

after(async () => {
    if (server) await new Promise(r => server.close(r));
    mock.restoreAll();
    await mongoose.disconnect();
    if (mongo?.pid && mongo.exitCode === null) {
        const exited = once(mongo, "exit");
        mongo.kill();
        await exited;
    }
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
});

test("1. GET /billing/plans returns public plans and resolved currency pricing without hardcoding", async () => {
    const res = await request("/plans", { user: null });
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
    const pro = res.body.data.plans.find(p => p.code === "PRO");
    assert.ok(pro);
    assert.equal(pro.prices.length, 2);
    const monthly = pro.prices.find(p => p.billingInterval === "MONTHLY");
    assert.equal(monthly.amountMinor, 9900);
    assert.equal(monthly.currency, "INR");
});

test("2. Free plan checkout is rejected: Free access requires no gateway checkout", async () => {
    const res = await request("/subscribe", { body: { planPriceId: String(freePrice._id) } });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Free plan does not require checkout/);
});

test("3. Paid checkout creates gateway plan mapping, checkout intent, and returns standardized response", async () => {
    const res = await request("/subscribe", { body: { planPriceId: String(proMonthlyPrice._id) } });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.provider, "RAZORPAY");
    assert.ok(res.body.data.subscriptionId);
    assert.ok(res.body.data.checkoutIntentId);
    assert.equal(res.body.data.plan.amountMinor, 9900);
    assert.equal(res.body.data.plan.currency, "INR");

    // Verify mapping was saved in database
    const mapping = await BillingPlanMappingModel.findOne({ planPriceId: proMonthlyPrice._id });
    assert.ok(mapping);
    assert.equal(mapping.amountMinor, 9900);
    assert.equal(mockProvider.createPlanCalls, 1);

    // Verify payment attempt recorded in subscription payment ledger
    const attempt = await SubscriptionPaymentModel.findOne({ providerSubscriptionId: res.body.data.subscriptionId });
    assert.ok(attempt);
    assert.equal(attempt.status, "INITIATED");
    assert.equal(attempt.amountMinor, 9900);
});

test("4. Concurrent or duplicate checkout request returns existing pending intent idempotently", async () => {
    const res = await request("/subscribe", { body: { planPriceId: String(proMonthlyPrice._id) } });
    assert.equal(res.status, 201);
    // Should reuse the plan mapping and not create a duplicate Razorpay plan
    assert.equal(mockProvider.createPlanCalls, 1);
});

test("5. Different user subscribing to same PlanPrice reuses cached Gateway Plan ID", async () => {
    const initialPlanCalls = mockProvider.createPlanCalls;
    const res = await request("/subscribe", { user: strangerId, body: { planPriceId: String(proMonthlyPrice._id) } });
    assert.equal(res.status, 201);
    // Provider createPlan was not called again
    assert.equal(mockProvider.createPlanCalls, initialPlanCalls);
});

test("6. Invalid or inactive PlanPrice returns 404", async () => {
    const nonExistent = new Types.ObjectId().toString();
    const res = await request("/subscribe", { body: { planPriceId: nonExistent } });
    assert.equal(res.status, 404);
});

test("7. Checkout callback verification: invalid signature is rejected with 400", async () => {
    const subRes = await request("/subscribe", { body: { planPriceId: String(proMonthlyPrice._id) } });
    const intentId = subRes.body.data.checkoutIntentId;
    const subId = subRes.body.data.subscriptionId;

    const verifyRes = await request("/verify", {
        body: {
            checkoutIntentId: intentId,
            razorpayPaymentId: "pay_123",
            razorpaySubscriptionId: subId,
            razorpaySignature: "invalid_tampered_signature",
        },
    });
    assert.equal(verifyRes.status, 400);
});

test("8. Checkout callback verification: valid signature activates paid subscription & records captured payment", async () => {
    const subRes = await request("/subscribe", { body: { planPriceId: String(proMonthlyPrice._id) } });
    const intentId = subRes.body.data.checkoutIntentId;
    const subId = subRes.body.data.subscriptionId;
    const paymentId = "pay_valid_" + new Types.ObjectId();

    // Generate valid HMAC signature
    const validSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(paymentId + "|" + subId)
        .digest("hex");

    const verifyRes = await request("/verify", {
        body: {
            checkoutIntentId: intentId,
            razorpayPaymentId: paymentId,
            razorpaySubscriptionId: subId,
            razorpaySignature: validSignature,
        },
    });

    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.data.verified);

    // Verify UserSubscription was transitioned to ACTIVE Pro
    const userSub = await UserSubscriptionModel.findOne({ user: ownerId, isActive: true });
    assert.equal(userSub.plan.toString(), proPlan._id.toString());
    assert.equal(userSub.status, "active");
    assert.ok(userSub.currentPeriodEnd > new Date());

    // Verify SubscriptionPayment recorded as CAPTURED
    const payment = await SubscriptionPaymentModel.findOne({ providerPaymentId: paymentId });
    assert.ok(payment);
    assert.equal(payment.status, "CAPTURED");
    assert.equal(payment.amountMinor, 9900);

    // Verify CheckoutIntent marked COMPLETED
    const intent = await CheckoutIntentModel.findOne({ checkoutIntentId: intentId });
    assert.equal(intent.status, "COMPLETED");
});

test("9. Active subscriber cannot start a duplicate identical checkout", async () => {
    const res = await request("/subscribe", { body: { planPriceId: String(proMonthlyPrice._id) } });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already actively subscribed/);
});

test("10. Webhook signature verification: valid signature is processed, invalid is rejected", async () => {
    const rawPayload = JSON.stringify({
        event: "subscription.charged",
        event_id: "evt_test_101",
        payload: {
            subscription: {
                entity: {
                    id: "sub_webhook_test",
                    current_start: Math.floor(Date.now() / 1000),
                    current_end: Math.floor((Date.now() + 30 * 86400000) / 1000),
                },
            },
            payment: {
                entity: {
                    id: "pay_wh_1",
                    amount: 9900,
                    currency: "INR",
                    status: "captured",
                },
            },
        },
    });

    const invalidSig = "bad_signature";
    const resInvalid = await request("/webhooks/razorpay", {
        user: null,
        body: rawPayload,
        headers: { "x-razorpay-signature": invalidSig, "x-razorpay-event-id": "evt_test_101" },
    });
    assert.equal(resInvalid.status, 400);

    // Valid signature
    const validSig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(Buffer.from(rawPayload))
        .digest("hex");

    const resValid = await request("/webhooks/razorpay", {
        user: null,
        body: rawPayload,
        headers: { "x-razorpay-signature": validSig, "x-razorpay-event-id": "evt_test_101" },
    });
    assert.equal(resValid.status, 200);
    assert.equal(resValid.body.data.event, "subscription.charged");
});

test("11. Webhook idempotency: repeated delivery of identical event is acknowledged without re-executing", async () => {
    const rawPayload = JSON.stringify({
        event: "subscription.activated",
        event_id: "evt_idempotent_test_202",
        payload: { subscription: { entity: { id: "sub_idempotent" } } },
    });
    const validSig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(Buffer.from(rawPayload))
        .digest("hex");

    const res1 = await request("/webhooks/razorpay", {
        user: null, body: rawPayload, headers: { "x-razorpay-signature": validSig, "x-razorpay-event-id": "evt_idempotent_test_202" },
    });
    assert.equal(res1.status, 200);

    const res2 = await request("/webhooks/razorpay", {
        user: null, body: rawPayload, headers: { "x-razorpay-signature": validSig, "x-razorpay-event-id": "evt_idempotent_test_202" },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.duplicate, true);
});

test("12. POST /billing/cancel schedules cancellation at period end with provider", async () => {
    const cancelRes = await request("/cancel", { body: { reason: "Need to take a break" } });
    assert.equal(cancelRes.status, 200);

    // Check that cancelAtPeriodEnd is true and access is retained until period end
    const sub = await UserSubscriptionModel.findOne({ user: ownerId, isActive: true });
    assert.equal(sub.cancelAtPeriodEnd, true);
    assert.equal(sub.status, "active");
    assert.ok(sub.cancellationEffectiveAt > new Date());
    assert.equal(mockProvider.cancelSubscriptionCalls, 1);
});

test("13. Downgrading to Free plan schedules cancellation at period end to prevent loss of paid time", async () => {
    const changeRes = await request("/change-plan", { body: { targetPlanPriceId: String(freePrice._id) } });
    assert.equal(changeRes.status, 200);
    const sub = await UserSubscriptionModel.findOne({ user: ownerId, isActive: true });
    assert.equal(sub.cancelAtPeriodEnd, true);
});

test("14. Cross-user access denial: User cannot verify an intent belonging to someone else", async () => {
    const subRes = await request("/subscribe", { user: strangerId, body: { planPriceId: String(proYearlyPrice._id) } });
    const strangerIntentId = subRes.body.data.checkoutIntentId;
    const strangerSubId = subRes.body.data.subscriptionId;

    // Owner tries to verify Stranger's checkout
    const hackRes = await request("/verify", {
        user: ownerId,
        body: {
            checkoutIntentId: strangerIntentId,
            razorpayPaymentId: "pay_stranger_1",
            razorpaySubscriptionId: strangerSubId,
            razorpaySignature: "dummy",
        },
    });
    assert.equal(hackRes.status, 404);
});

test("15. BillingReconciliationService reconciles stale pending checkout intents", async () => {
    const expiredIntent = await CheckoutIntentModel.create({
        checkoutIntentId: "intent_stale_1",
        user: new Types.ObjectId(strangerId),
        planId: proPlan._id,
        planPriceId: proMonthlyPrice._id,
        billingInterval: "MONTHLY",
        provider: BillingProviderName.RAZORPAY,
        providerSubscriptionId: "sub_stale_1",
        amountMinor: 9900,
        currency: "INR",
        status: CheckoutIntentStatus.PENDING,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    mockProvider.subscriptions.set("sub_stale_1", {
        id: "sub_stale_1",
        planId: "plan_1",
        status: "active",
        currentStart: new Date(),
        currentEnd: new Date(Date.now() + 30 * 86400000),
        totalCount: 120,
        paidCount: 1,
        remainingCount: 119,
    });

    const report = await reconciliationService.reconcile(10);
    assert.ok(report.scannedIntents >= 1);
    assert.ok(report.reconciledIntents >= 1);

    const updatedIntent = await CheckoutIntentModel.findOne({ checkoutIntentId: "intent_stale_1" });
    assert.equal(updatedIntent.status, CheckoutIntentStatus.COMPLETED);
});

test("16. GET /billing/history returns paginated payment ledger", async () => {
    const res = await request("/history?page=1&limit=10");
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.ok(res.body.data.length >= 1);
});
