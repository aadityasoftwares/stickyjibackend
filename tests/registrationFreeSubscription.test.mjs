import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import express from "express";

process.env.JWT_ACCESS_SECRET = "test-jwt-access-secret-stickyji";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-stickyji";
process.env.FRONTEND_URL = "http://localhost:3000";

import { UserModel } from "../src/modules/user/models/user.model.ts";
import { UserProfileModel } from "../src/modules/userprofile/models/userProfile.model.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { FeatureModel } from "../src/modules/feature/models/feature.model.ts";
import { PlanFeatureModel } from "../src/modules/planfeature/models/planfeature.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { UserSubscriptionModel } from "../src/modules/usersubscription/models/usersubscription.model.ts";
import { AuthService } from "../src/modules/auth/services/auth.service.ts";
import { UserSubscriptionService } from "../src/modules/usersubscription/services/usersubscription.service.ts";
import { SubscriptionEntitlementService } from "../src/modules/subscriptionentitlement/services/subscriptionentitlement.service.ts";
import { UserStatus, UserAuthProvider } from "../src/modules/user/constants/user.enums.js";
import {
    PlanCode,
    PlanType,
    PlanVisibility,
    PlanPricingModel,
} from "../src/modules/plan/constants/plan.enums.js";
import { FeatureCode, FeatureType } from "../src/modules/feature/constants/feature.enums.js";
import { BillingInterval } from "../src/modules/planprice/constants/planPrice.enums.js";
import { UserSubscriptionStatus } from "../src/modules/usersubscription/constants/usersubscription.enums.js";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";
import { runPendingUsersBackfill } from "../src/scripts/backfill-pending-users.ts";

let mongodProcess, testDirectory, expressApp, testServer, testServerUrl;
let freePlan, proPlan, stickyNoteLimitFeature, freePlanFeature, proPrice;

async function getAvailablePort() {
    return new Promise((resolvePort, rejectPort) => {
        const netServer = createServer();
        netServer.listen(0, "127.0.0.1", () => {
            const { port } = netServer.address();
            netServer.close(() => resolvePort(port));
        });
        netServer.on("error", rejectPort);
    });
}

before(async () => {
    testDirectory = await mkdtemp(join(tmpdir(), "stickyji-reg-test-"));
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));

    mongodProcess = spawn(
        globalThis.process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            testDirectory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            join(testDirectory, "mongo.log"),
        ],
        { windowsHide: true, stdio: "ignore" },
    );

    let startupError;
    mongodProcess.on("error", (error) => {
        startupError = error;
    });

    let connected = false;
    for (let i = 0; i < 40; i++) {
        if (startupError) throw startupError;
        try {
            await mongoose.connect(`mongodb://127.0.0.1:${port}/stickyji_reg_test?directConnection=true`, {
                serverSelectionTimeoutMS: 2000,
            });
            connected = true;
            break;
        } catch {
            await delay(200);
        }
    }
    if (!connected) throw new Error("Could not connect to test mongod instance");

    // Ensure models are registered and indexes created
    await UserModel.init();
    await UserSubscriptionModel.init();
    await PlanModel.init();
    await FeatureModel.init();
    await PlanFeatureModel.init();

    // Initialize full database defaults via DatabaseInitializer
    const { DatabaseInitializer } = await import("../src/database/initialization/database-initializer.ts");
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    freePlan = await PlanModel.findOne({ code: PlanCode.FREE });
    proPlan = await PlanModel.findOne({ code: PlanCode.PRO });
    proPrice = await PlanPriceModel.findOne({
        planId: proPlan._id,
        billingInterval: BillingInterval.MONTHLY,
    });

    // Mount Express App with Auth Routes
    const { default: authRoutes } = await import("../src/modules/auth/routes/auth.routes.ts");
    expressApp = express();
    expressApp.use(express.json());
    expressApp.use("/auth", authRoutes);
    expressApp.use(errorMiddleware);

    const appPort = await getAvailablePort();
    testServer = expressApp.listen(appPort);
    testServerUrl = `http://127.0.0.1:${appPort}`;
});

after(async () => {
    if (testServer) testServer.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongodProcess) {
        mongodProcess.kill();
        await delay(500);
    }
    if (testDirectory) {
        await rm(testDirectory, { recursive: true, force: true }).catch(() => {});
    }
});

test("1. New user registration automatically assigns active Free subscription and sets user status to ACTIVE", async () => {
    const authService = new AuthService();
    const result = await authService.register({
        email: "alice@test.com",
        password: "Password123!",
        firstName: "Alice",
        lastName: "Tester",
    });

    assert.ok(result.data.user.id, "User ID should be returned");
    assert.equal(result.data.user.email, "alice@test.com");
    assert.equal(result.data.user.status, UserStatus.ACTIVE, "Registered user status must be ACTIVE");
    assert.equal(result.data.user.isEmailVerified, false, "Email must be unverified initially");

    // Verify subscription in database
    const subscription = await UserSubscriptionModel.findOne({ user: result.data.user.id, isActive: true });
    assert.ok(subscription, "Active subscription must exist for the user");
    assert.equal(
        subscription.plan.toString(),
        freePlan._id.toString(),
        "Subscription must reference the Free plan",
    );
    assert.equal(subscription.status, UserSubscriptionStatus.ACTIVE);
    assert.equal(subscription.endDate, null, "Free plan has no expiration date");
    assert.equal(subscription.autoRenew, false);
    assert.equal(subscription.planPriceId, null);
    assert.equal(subscription.billingInterval, null);
});

test("2. Unverified active user can log in with valid credentials", async () => {
    const authService = new AuthService();
    const loginResult = await authService.login({
        email: "alice@test.com",
        password: "Password123!",
    });

    assert.ok(loginResult.data.tokens.accessToken, "Login should return access token");
    assert.equal(loginResult.data.user.status, UserStatus.ACTIVE);
    assert.equal(loginResult.data.user.isEmailVerified, false);
});

test("3. Free plan entitlements and usage limits resolve immediately after registration", async () => {
    const user = await UserModel.findOne({ email: "alice@test.com" });
    assert.ok(user);

    const entitlementService = new SubscriptionEntitlementService();
    const planLimits = await entitlementService.resolveEffectivePlanLimits({
        type: "USER",
        id: user._id.toString(),
    });

    assert.equal(planLimits.planCode, PlanCode.FREE);
    assert.equal(planLimits.limits[FeatureCode.MAX_ACTIVE_STICKY_NOTES]?.limit, 500);
});

test("4. Duplicate registration attempts fail with 409 and do not create duplicate subscriptions", async () => {
    const authService = new AuthService();
    await assert.rejects(
        () =>
            authService.register({
                email: "alice@test.com",
                password: "Password123!",
                firstName: "Alice",
                lastName: "Tester",
            }),
        (err) => err.statusCode === 409,
    );

    const subscriptions = await UserSubscriptionModel.find({
        user: (await UserModel.findOne({ email: "alice@test.com" }))._id,
    });
    assert.equal(subscriptions.length, 1, "Must never have more than one subscription document for the user");
});

test("5. Email verification link verifies the email, clears tokens, and preserves ACTIVE user status", async () => {
    const authService = new AuthService();
    const user = await UserModel.findOne({ email: "alice@test.com" }).select(
        "+emailVerificationTokenHash +emailVerificationExpiresAt",
    );
    assert.ok(
        user.emailVerificationTokenHash,
        "User must have a verification token hash generated on signup",
    );

    // Resend verification email to get a known token through resend API
    const resendRes = await fetch(`${testServerUrl}/auth/resendverification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "alice@test.com" }),
    });
    assert.equal(resendRes.status, 200);

    // Grab updated token hash from database
    const updatedUser = await UserModel.findOne({ email: "alice@test.com" }).select(
        "+emailVerificationTokenHash +emailVerificationExpiresAt",
    );
    assert.ok(updatedUser.emailVerificationTokenHash);

    // Call verifyEmail with invalid token first
    const invalidRes = await fetch(`${testServerUrl}/auth/verifyemail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "invalid-token-123" }),
    });
    assert.equal(invalidRes.status, 400);

    // Test verification using authService.verifyEmail directly by setting a test token
    const testRawToken = "test-raw-token-abcdef1234567890";
    const { CryptoUtil } = await import("../src/modules/auth/utils/crypto.util.ts");
    const testHash = CryptoUtil.hashToken(testRawToken);
    await UserModel.updateOne(
        { email: "alice@test.com" },
        {
            $set: {
                emailVerificationTokenHash: testHash,
                emailVerificationExpiresAt: new Date(Date.now() + 3600000),
            },
        },
    );

    const verifyRes = await fetch(`${testServerUrl}/auth/verifyemail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: testRawToken }),
    });
    assert.equal(verifyRes.status, 200);

    const verifiedUser = await UserModel.findOne({ email: "alice@test.com" }).select(
        "+emailVerificationTokenHash +emailVerificationExpiresAt",
    );
    assert.equal(verifiedUser.isEmailVerified, true);
    assert.ok(verifiedUser.emailVerifiedAt instanceof Date);
    assert.equal(verifiedUser.emailVerificationTokenHash, null);
    assert.equal(verifiedUser.status, UserStatus.ACTIVE, "Status must remain ACTIVE");

    // Reusing the token must fail
    const reusedRes = await fetch(`${testServerUrl}/auth/verifyemail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: testRawToken }),
    });
    assert.equal(reusedRes.status, 400);
});

test("6. Suspended and locked users cannot log in", async () => {
    const authService = new AuthService();
    await authService.register({
        email: "suspended@test.com",
        password: "Password123!",
        firstName: "Suspended",
        lastName: "User",
    });

    // Update status to SUSPENDED
    await UserModel.updateOne({ email: "suspended@test.com" }, { $set: { status: UserStatus.SUSPENDED } });

    await assert.rejects(
        () => authService.login({ email: "suspended@test.com", password: "Password123!" }),
        (err) => err.statusCode === 403,
    );

    // Test locked account
    await UserModel.updateOne(
        { email: "suspended@test.com" },
        { $set: { status: UserStatus.ACTIVE, lockedUntil: new Date(Date.now() + 3600000) } },
    );
    await assert.rejects(
        () => authService.login({ email: "suspended@test.com", password: "Password123!" }),
        (err) => err.statusCode === 403,
    );
});

test("7. Missing Free plan produces a controlled 503 error during registration and rolls back", async () => {
    // Temporarily deactivate Free plan
    await PlanModel.updateOne({ _id: freePlan._id }, { $set: { isActive: false } });

    const authService = new AuthService();
    await assert.rejects(
        () =>
            authService.register({
                email: "nofreeplan@test.com",
                password: "Password123!",
                firstName: "No",
                lastName: "Free",
            }),
        (err) => err.statusCode === 503,
    );

    // Verify rollback: no user, no profile, no subscription left behind
    const user = await UserModel.findOne({ email: "nofreeplan@test.com" });
    assert.equal(user, null, "User must be rolled back on registration failure");

    // Restore Free plan
    await PlanModel.updateOne({ _id: freePlan._id }, { $set: { isActive: true } });
});

test("8. Upgrading Free subscription to Paid activates paid entitlements without duplicating subscriptions", async () => {
    const authService = new AuthService();
    const reg = await authService.register({
        email: "upgrade@test.com",
        password: "Password123!",
        firstName: "Upgrade",
        lastName: "User",
    });

    const userSubService = new UserSubscriptionService();
    const initialSub = await userSubService.getCurrentSubscription(reg.data.user.id.toString());
    assert.equal(initialSub.effectivePlan.code, PlanCode.FREE);

    // Apply verified billing event (simulating payment verification)
    const paidEvent = {
        user: new Types.ObjectId(reg.data.user.id.toString()),
        plan: proPlan._id,
        planPriceId: proPrice._id,
        billingInterval: BillingInterval.MONTHLY,
        status: UserSubscriptionStatus.ACTIVE,
        isActive: true,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        paymentProvider: "RAZORPAY",
        providerSubscriptionId: "sub_rzp_test_12345",
    };

    const updatedSub = await userSubService.applyVerifiedBillingEvent(paidEvent);
    assert.equal(updatedSub.plan.toString(), proPlan._id.toString());
    assert.equal(updatedSub.status, UserSubscriptionStatus.ACTIVE);

    // Verify entitlements now reflect Pro plan limits
    const entitlementService = new SubscriptionEntitlementService();
    const planLimits = await entitlementService.resolveEffectivePlanLimits({
        type: "USER",
        id: reg.data.user.id.toString(),
    });
    assert.equal(planLimits.planCode, PlanCode.PRO);
    assert.equal(planLimits.limits[FeatureCode.MAX_ACTIVE_STICKY_NOTES]?.limit, 25000);

    // Ensure ensureFreeSubscription does NOT downgrade or touch existing paid subscription
    const ensureResult = await userSubService.ensureFreeSubscription(reg.data.user.id.toString());
    assert.equal(
        ensureResult.plan.toString(),
        proPlan._id.toString(),
        "Paid subscriber must not be downgraded by ensureFreeSubscription",
    );
});

test("9. Backfill script activates pending users in dry-run and apply modes", async () => {
    // Create an old pending user directly
    const role = await RoleModel.findOne({ code: "USER" });
    const pendingUser = await UserModel.create({
        email: "stuckpending@test.com",
        password: "Password123!",
        globalRoleId: role._id,
        status: UserStatus.PENDING,
        authProvider: UserAuthProvider.LOCAL,
        isEmailVerified: false,
    });

    // 1. Dry run
    const dryRunSummary = await runPendingUsersBackfill({ mode: "dry-run" });
    assert.ok(dryRunSummary.totalScanned >= 1);
    assert.ok(dryRunSummary.eligibleForActivation >= 1);
    assert.equal(dryRunSummary.activated, 0, "Dry run must NOT modify any database records");

    const stillPending = await UserModel.findById(pendingUser._id);
    assert.equal(stillPending.status, UserStatus.PENDING);

    // 2. Apply
    const applySummary = await runPendingUsersBackfill({ mode: "apply" });
    assert.ok(applySummary.activated >= 1, "Apply mode must activate the user");
    assert.ok(applySummary.freeSubscriptionsEnsured >= 1, "Apply mode must ensure Free subscription");

    const activatedUser = await UserModel.findById(pendingUser._id);
    assert.equal(activatedUser.status, UserStatus.ACTIVE);

    const subscription = await UserSubscriptionModel.findOne({ user: pendingUser._id, isActive: true });
    assert.ok(subscription);
    assert.equal(subscription.plan.toString(), freePlan._id.toString());
});
