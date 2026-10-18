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
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { PlanFeatureModel } from "../src/modules/planfeature/models/planfeature.model.ts";
import { FeatureModel } from "../src/modules/feature/models/feature.model.ts";
import { CurrencyModel } from "../src/modules/currency/models/currency.model.ts";
import { UserSubscriptionModel } from "../src/modules/usersubscription/models/usersubscription.model.ts";
import { PlanRepository } from "../src/modules/plan/repositories/plan.repository.ts";
import { errorMiddleware } from "../src/middlewares/error/error.middleware.ts";

process.env.JWT_ACCESS_SECRET = "plan-test-access-secret";
process.env.JWT_REFRESH_SECRET = "plan-test-refresh-secret";
const { JwtUtil } = await import("../src/modules/auth/utils/jwt.util.ts");
const { default: planRoutes } = await import("../src/modules/plan/routes/plan.routes.ts");

let mongoProcess, mongoDirectory, httpServer, baseUrl;
const repository = new PlanRepository();

const testUserId = new Types.ObjectId();
const testCurrencyId = new Types.ObjectId();

const samplePlans = [
    {
        _id: new Types.ObjectId(),
        name: "Free Starter",
        code: "FREE",
        description: "Starter free plan",
        type: "FREE",
        pricingModel: "FIXED",
        trialDays: 0,
        visibility: "PUBLIC",
        isPopular: false,
        sortOrder: 1,
        isDefault: true,
        isSystem: true,
        isActive: true,
    },
    {
        _id: new Types.ObjectId(),
        name: "Pro Professional",
        code: "PRO",
        description: "Pro features for power users",
        type: "PAID",
        pricingModel: "FIXED",
        trialDays: 14,
        visibility: "PUBLIC",
        isPopular: true,
        sortOrder: 2,
        isDefault: false,
        isSystem: false,
        isActive: true,
    },
    {
        _id: new Types.ObjectId(),
        name: "Team Collaboration",
        code: "TEAM",
        description: "For collaborating teams",
        type: "PAID",
        pricingModel: "FIXED",
        trialDays: 14,
        visibility: "PUBLIC",
        isPopular: false,
        sortOrder: 3,
        isDefault: false,
        isSystem: false,
        isActive: true,
    },
    {
        _id: new Types.ObjectId(),
        name: "Enterprise Custom",
        code: "ENTERPRISE",
        description: "For large enterprise deployments",
        type: "CUSTOM",
        pricingModel: "CUSTOM",
        trialDays: 30,
        visibility: "PUBLIC",
        isPopular: false,
        sortOrder: 4,
        isDefault: false,
        isSystem: false,
        isActive: false,
    },
    {
        _id: new Types.ObjectId(),
        name: "Individual Private",
        code: "INDIVIDUAL",
        description: "Private single-user plan",
        type: "PAID",
        pricingModel: "FIXED",
        trialDays: 7,
        visibility: "PRIVATE",
        isPopular: false,
        sortOrder: 5,
        isDefault: false,
        isSystem: false,
        isActive: false,
    },
];

const sampleFeatureId = new Types.ObjectId();
const sampleFeature2Id = new Types.ObjectId();

async function request(path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
}

async function requestMethod(method, path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
}

before(async () => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((res) => socket.close(res));

    mongoDirectory = await mkdtemp(join(tmpdir(), "plan-list-test-"));
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
            await mongoose.connect(`mongodb://127.0.0.1:${port}/plan_list_test`, {
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
        PlanModel.createIndexes(),
        PlanPriceModel.createIndexes(),
        PlanFeatureModel.createIndexes(),
        FeatureModel.createIndexes(),
        CurrencyModel.createIndexes(),
        UserSubscriptionModel.createIndexes(),
    ]);

    await PlanModel.collection.insertMany(samplePlans);

    await CurrencyModel.collection.insertOne({
        _id: testCurrencyId,
        code: "INR",
        name: "Indian Rupee",
        symbol: "₹",
        numericCode: "356",
        decimalPlaces: 2,
        isActive: true,
        isDefault: true,
    });

    await FeatureModel.collection.insertMany([
        {
            _id: sampleFeatureId,
            name: "Workspaces",
            code: "MAX_WORKSPACES",
            description: "Number of workspaces",
            category: "CORE",
            type: "QUOTA",
            isActive: true,
            isDefault: true,
            isSystem: true,
        },
        {
            _id: sampleFeature2Id,
            name: "Team Collaboration",
            code: "MEMBERS",
            description: "Workspace collaboration",
            category: "COLLABORATION",
            type: "BOOLEAN",
            isActive: true,
            isDefault: true,
            isSystem: true,
        },
    ]);

    await PlanPriceModel.collection.insertMany([
        {
            _id: new Types.ObjectId(),
            planId: samplePlans[1]._id, // PRO
            currencyId: testCurrencyId,
            billingInterval: "MONTHLY",
            amountMinor: 9900,
            sortOrder: 1,
            isActive: true,
        },
        {
            _id: new Types.ObjectId(),
            planId: samplePlans[1]._id, // PRO
            currencyId: testCurrencyId,
            billingInterval: "YEARLY",
            amountMinor: 99000,
            sortOrder: 2,
            isActive: true,
        },
    ]);

    await PlanFeatureModel.collection.insertMany([
        {
            _id: new Types.ObjectId(),
            planId: samplePlans[0]._id, // FREE
            featureId: sampleFeatureId,
            isEnabled: true,
            limit: 3,
            limitType: "COUNT",
            isUnlimited: false,
            sortOrder: 1,
        },
        {
            _id: new Types.ObjectId(),
            planId: samplePlans[1]._id, // PRO
            featureId: sampleFeatureId,
            isEnabled: true,
            limit: 20,
            limitType: "COUNT",
            isUnlimited: false,
            sortOrder: 1,
        },
        {
            _id: new Types.ObjectId(),
            planId: samplePlans[1]._id, // PRO
            featureId: sampleFeature2Id,
            isEnabled: true,
            limit: 0,
            limitType: "NONE",
            isUnlimited: true,
            sortOrder: 2,
        },
    ]);

    await UserSubscriptionModel.collection.insertOne({
        _id: new Types.ObjectId(),
        user: testUserId,
        plan: samplePlans[0]._id, // Free
        status: "active",
        startDate: new Date(),
        isActive: true,
        revision: 0,
    });

    mock.method(JwtUtil, "verifyAccessToken", (token) => {
        if (token === "valid-user-token") {
            return { sub: String(testUserId), sessionId: "test-session" };
        }
        throw new Error("Invalid token");
    });

    const app = express();
    app.use(express.json());
    app.use("/api/v1/plans", planRoutes);
    app.use(errorMiddleware);

    httpServer = app.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    baseUrl = `http://127.0.0.1:${httpServer.address().port}/api/v1/plans`;
});

after(async () => {
    if (httpServer) await new Promise((res) => httpServer.close(res));
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
        assert.ok(basename(target).startsWith("plan-list-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

test("GET /getall defaults to active plans with standard metadata", async () => {
    const res = await request("/getall");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 3);
    assert.ok(res.body.data.every((p) => p.isActive === true));
    assert.deepEqual(res.body.meta.counts, { all: 5, active: 3, inactive: 2 });
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 20);
    assert.equal(res.body.meta.total, 3);
});

test("POST /getall works identically to GET and supports body filtering", async () => {
    const getRes = await request("/getall?status=ALL");
    const postRes = await request("/getall", { status: "ALL" });

    assert.equal(postRes.status, 200);
    assert.equal(postRes.body.success, true);
    assert.deepEqual(postRes.body.meta, getRes.body.meta);
    assert.deepEqual(postRes.body.data, getRes.body.data);
    assert.equal(postRes.body.data.length, 5);
});

test("status filters (ACTIVE, INACTIVE, ALL) have independent tab counts", async () => {
    const active = await request("/getall", { status: "ACTIVE" });
    assert.equal(active.body.data.length, 3);
    assert.equal(active.body.meta.total, 3);
    assert.deepEqual(active.body.meta.counts, { all: 5, active: 3, inactive: 2 });

    const inactive = await request("/getall", { status: "INACTIVE" });
    assert.equal(inactive.body.data.length, 2);
    assert.equal(inactive.body.meta.total, 2);
    assert.deepEqual(inactive.body.meta.counts, { all: 5, active: 3, inactive: 2 });

    const all = await request("/getall", { status: "ALL" });
    assert.equal(all.body.data.length, 5);
    assert.equal(all.body.meta.total, 5);
    assert.deepEqual(all.body.meta.counts, { all: 5, active: 3, inactive: 2 });
});

test("search by name and code works case-insensitively and trims", async () => {
    const searchRes = await request("/getall", { search: " pro ", status: "ALL" });
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.data.length, 1);
    assert.equal(searchRes.body.data[0].code, "PRO");

    const codeSearch = await request("/getall", { search: "TEAM", status: "ALL" });
    assert.equal(codeSearch.body.data.length, 1);
    assert.equal(codeSearch.body.data[0].code, "TEAM");
});

test("sorting by NAME_ASC and NAME_DESC", async () => {
    const asc = await request("/getall", { status: "ALL", sortBy: "NAME_ASC" });
    const namesAsc = asc.body.data.map((p) => p.name);
    assert.deepEqual(namesAsc, [
        "Enterprise Custom",
        "Free Starter",
        "Individual Private",
        "Pro Professional",
        "Team Collaboration",
    ]);

    const desc = await request("/getall", { status: "ALL", sortBy: "NAME_DESC" });
    const namesDesc = desc.body.data.map((p) => p.name);
    assert.deepEqual(namesDesc, [
        "Team Collaboration",
        "Pro Professional",
        "Individual Private",
        "Free Starter",
        "Enterprise Custom",
    ]);
});

test("pagination coercion and page limits", async () => {
    const page1 = await request("/getall", { status: "ALL", page: 1, limit: 2 });
    assert.equal(page1.body.data.length, 2);
    assert.equal(page1.body.meta.page, 1);
    assert.equal(page1.body.meta.limit, 2);
    assert.equal(page1.body.meta.total, 5);
    assert.equal(page1.body.meta.totalPages, 3);

    const page3 = await request("/getall", { status: "ALL", page: 3, limit: 2 });
    assert.equal(page3.body.data.length, 1);
    assert.equal(page3.body.meta.page, 3);
});

test("GET /get/:id and GET /get/code/:code fetch individual plans", async () => {
    const proId = String(samplePlans[1]._id);
    const byId = await request(`/get/${proId}`);
    assert.equal(byId.status, 200);
    assert.equal(byId.body.data.code, "PRO");
    assert.equal(byId.body.data.id, proId);

    const byCode = await request("/get/code/PRO");
    assert.equal(byCode.status, 200);
    assert.equal(byCode.body.data.code, "PRO");
    assert.equal(byCode.body.data.id, proId);
});

test("PUT /status/:id and PATCH /update/:id/status updates active status", async () => {
    const proId = String(samplePlans[1]._id);

    const deactivate = await requestMethod("PUT", `/status/${proId}`, { isActive: false });
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.body.data.isActive, false);

    const reactivate = await requestMethod("PATCH", `/update/${proId}/status`, { isActive: true });
    assert.equal(reactivate.status, 200);
    assert.equal(reactivate.body.data.isActive, true);
});

test("PUT /update/:id updates plan details", async () => {
    const proId = String(samplePlans[1]._id);

    const updateRes = await requestMethod("PUT", `/update/${proId}`, {
        name: "Pro Professional Updated",
        description: "Updated description for Pro plan",
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.name, "Pro Professional Updated");
    assert.equal(updateRes.body.data.description, "Updated description for Pro plan");
});

test("POST /create and DELETE /delete/:id for custom plan", async () => {
    const newPlan = {
        name: "Custom Test Plan",
        code: "ENTERPRISE",
        description: "Test description",
    };
    const dupRes = await requestMethod("POST", "/create", newPlan);
    assert.equal(dupRes.status, 409);

    const freeId = String(samplePlans[0]._id);
    const deleteFreeRes = await requestMethod("DELETE", `/delete/${freeId}`);
    assert.equal(deleteFreeRes.status, 403);
});

test("invalid input validation returns standardized 400 errors", async () => {
    for (const body of [
        { page: 0 },
        { limit: -1 },
        { status: "INVALID" },
        { sortBy: "UNKNOWN_FIELD" },
        { unknownProp: true },
    ]) {
        const res = await request("/getall", body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal(res.body.success, false);
    }
});

test("GET /subscriptionplans returns unified pricing, features, highlights and matrix", async () => {
    const res = await request("/subscriptionplans");
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const { plans, currency, comparisonMatrix, userSubscription, billingIntervals } = res.body.data;

    assert.equal(currency.code, "INR");
    assert.equal(currency.symbol, "₹");
    assert.deepEqual(billingIntervals, ["MONTHLY", "YEARLY"]);
    assert.equal(userSubscription, null); // Unauthenticated guest

    // Check Free Plan
    const free = plans.find((p) => p.code === "FREE");
    assert.ok(free);
    assert.equal(free.badge, "Free Forever");
    assert.equal(free.pricing.monthly.amountMajor, 0);
    assert.equal(free.pricing.monthly.formatted, "Free");
    assert.ok(free.highlights.includes("3 Workspaces"));

    // Check Pro Plan
    const pro = plans.find((p) => p.code === "PRO");
    assert.ok(pro);
    assert.equal(pro.badge, "Most Popular");
    assert.equal(pro.pricing.monthly.amountMajor, 99);
    assert.equal(pro.pricing.monthly.formatted, "₹99/month");
    assert.equal(pro.pricing.yearly.amountMajor, 990);
    assert.equal(pro.pricing.yearly.formatted, "₹990/year");
    assert.equal(pro.pricing.yearly.savingsPercentage, 17); // (99*12 - 990) / (99*12) ~ 17%
    assert.equal(pro.pricing.yearly.monthlyEquivalent, 82.5);

    // Check Features list & formatted limits
    const proWsFeature = pro.features.find((f) => f.code === "MAX_WORKSPACES");
    assert.ok(proWsFeature);
    assert.equal(proWsFeature.formattedLimit, "20 Workspaces");
    assert.equal(proWsFeature.limit, 20);

    const proMembersFeature = pro.features.find((f) => f.code === "MEMBERS");
    assert.ok(proMembersFeature);
    assert.equal(proMembersFeature.formattedLimit, "Unlimited");

    // Check feature categories grouping
    assert.ok(Array.isArray(pro.featureCategories.CORE));
    assert.ok(Array.isArray(pro.featureCategories.COLLABORATION));

    // Check Comparison Matrix
    assert.ok(Array.isArray(comparisonMatrix));
    const matrixRow = comparisonMatrix.find((r) => r.featureCode === "MAX_WORKSPACES");
    assert.ok(matrixRow);
    assert.equal(matrixRow.plans.FREE.included, true);
    assert.equal(matrixRow.plans.FREE.formattedValue, "3 Workspaces");
    assert.equal(matrixRow.plans.PRO.included, true);
    assert.equal(matrixRow.plans.PRO.formattedValue, "20 Workspaces");
});

test("GET /subscriptionplans with auth token marks user's current plan and active subscription", async () => {
    const res = await request("/subscriptionplans", undefined, "valid-user-token");
    assert.equal(res.status, 200);

    const { plans, userSubscription } = res.body.data;

    assert.ok(userSubscription);
    assert.equal(userSubscription.planId, String(samplePlans[0]._id));
    assert.equal(userSubscription.planCode, "FREE");
    assert.equal(userSubscription.status, "active");

    const free = plans.find((p) => p.code === "FREE");
    assert.equal(free.isCurrent, true);

    const pro = plans.find((p) => p.code === "PRO");
    assert.equal(pro.isCurrent, false);
});

test("GET /pricing and POST /subscriptionplans work as aliases", async () => {
    const pricingRes = await request("/pricing");
    const postRes = await request("/subscriptionplans", {});

    assert.equal(pricingRes.status, 200);
    assert.equal(postRes.status, 200);
    assert.equal(pricingRes.body.data.plans.length, postRes.body.data.plans.length);
});
