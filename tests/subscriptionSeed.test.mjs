import assert from "node:assert/strict";
import { before, after, beforeEach, test, mock } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import mongoose, { Types } from "mongoose";
import { SubscriptionSeedService } from "../src/seeders/subscription/services/subscription-seed.service.ts";
import {
    SubscriptionSeedRepository,
    SUBSCRIPTION_REQUIRED_INDEXES,
} from "../src/seeders/subscription/repositories/subscription-seed.repository.ts";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../src/seeders/subscription/constants/default-plans.constants.ts";
import { DEFAULT_SUBSCRIPTION_FEATURES } from "../src/seeders/subscription/constants/default-features.constants.ts";
import { DEFAULT_SUBSCRIPTION_LIMITS } from "../src/seeders/subscription/constants/default-limits.constants.ts";
import { DEFAULT_SUBSCRIPTION_PRICES } from "../src/seeders/subscription/constants/default-plan-prices.constants.ts";
import { parseSubscriptionSeedArguments } from "../src/scripts/seed-default-subscriptions.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { FeatureModel } from "../src/modules/feature/models/feature.model.ts";
import { PlanFeatureModel } from "../src/modules/planfeature/models/planfeature.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { UserSubscriptionService } from "../src/modules/usersubscription/services/usersubscription.service.ts";
import { UserModel } from "../src/modules/user/models/user.model.ts";

const repository = new SubscriptionSeedRepository();
const service = new SubscriptionSeedService(repository);
const processes = [];
let mongo, uri;

async function connect(target) {
    await mongoose.disconnect();
    await mongoose.connect(target, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 500 });
}

async function startMongo(replicaSet = false) {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const directory = await mkdtemp(join(tmpdir(), "subscription-seed-test-"));
    const process = spawn(
        globalThis.process.env.MONGOD_BINARY ?? "mongod",
        [
            "--dbpath",
            directory,
            "--port",
            String(port),
            "--bind_ip",
            "127.0.0.1",
            "--logpath",
            join(directory, "mongo.log"),
            ...(replicaSet ? ["--replSet", "subscription-seed"] : []),
        ],
        { windowsHide: true, stdio: "ignore" },
    );
    const result = { process, directory, base: "mongodb://127.0.0.1:" + port };
    processes.push(result);
    let startupError;
    process.on("error", (error) => {
        startupError = error;
    });
    for (let attempt = 0; ; attempt++) {
        if (startupError) throw startupError;
        try {
            await connect(result.base + "/bootstrap?directConnection=true");
            break;
        } catch (error) {
            if (attempt > 40) throw error;
            await delay(200);
        }
    }
    if (replicaSet) {
        await mongoose.connection.db.admin().command({
            replSetInitiate: { _id: "subscription-seed", members: [{ _id: 0, host: "127.0.0.1:" + port }] },
        });
        for (let attempt = 0; ; attempt++) {
            const hello = await mongoose.connection.db.admin().command({ hello: 1 });
            if (hello.isWritablePrimary) break;
            if (attempt > 100) throw new Error("Replica set did not elect a primary");
            await delay(200);
        }
    }
    return result;
}

before(async () => {
    mongo = await startMongo();
});
beforeEach(async () => {
    uri = mongo.base + "/seed_" + new Types.ObjectId();
    await connect(uri);
});
after(async () => {
    mock.restoreAll();
    await mongoose.disconnect();
    for (const item of processes) {
        if (item.process.pid && item.process.exitCode === null) {
            const stopped = once(item.process, "exit");
            item.process.kill();
            await stopped;
        }
        const target = resolve(item.directory);
        assert.equal(dirname(target), resolve(tmpdir()));
        assert.ok(basename(target).startsWith("subscription-seed-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

async function seed(options = {}) {
    const report = await service.run({ mode: "apply", ...options });
    assert.equal(report.valid, true, JSON.stringify({ conflicts: report.conflicts, errors: report.errors }));
    assert.equal(report.applied, true);
    return report;
}

async function snapshotAll() {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const result = {};
    for (const collection of collections) {
        result[collection.name] = {
            rows: await mongoose.connection.db.collection(collection.name).find().sort({ _id: 1 }).toArray(),
            indexes: await mongoose.connection.db.collection(collection.name).indexes(),
        };
    }
    return result;
}

async function command(args, environment = {}) {
    const child = spawn(
        process.execPath,
        ["--import", "tsx", "src/scripts/seed-default-subscriptions.ts", ...args],
        {
            windowsHide: true,
            env: { ...process.env, MONGO_URI: uri, ...environment },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    let output = "";
    child.stdout.on("data", (chunk) => {
        output += chunk;
    });
    child.stderr.on("data", (chunk) => {
        output += chunk;
    });
    const [code] = await once(child, "exit");
    return { code, output };
}

test("empty database seeds three plans, equal capabilities, six quotas and four paise prices", async () => {
    const report = await seed();
    assert.equal(report.transactions, false);
    assert.equal(report.counts.plans.created, 3);
    assert.equal(report.counts.features.created, 21);
    assert.equal(report.counts.planFeatures.created, 63);
    assert.equal(report.counts.planPrices.created, 4);
    assert.equal(report.counts.planPrices.skipped, 2);
    assert.equal(await PlanModel.countDocuments({ isDefault: true }), 1);
    assert.equal((await PlanModel.findOne({ isDefault: true })).code, "FREE");
    assert.deepEqual(
        (await PlanPriceModel.find().sort({ amountMinor: 1 }).lean()).map((row) => row.amountMinor),
        [4900, 9900, 49000, 99000],
    );
    assert.equal((await service.run({ mode: "verify" })).valid, true);
});

test("rerunning is a real no-op, preserving ObjectIds and all timestamps", async () => {
    await seed();
    const before = await snapshotAll();
    const report = await seed();
    assert.equal(report.operations.length, 0);
    assert.deepEqual(await snapshotAll(), before);
    assert.equal(report.counts.plans.created, 0);
    assert.equal(report.counts.features.created, 0);
    assert.equal(report.counts.planPrices.created, 0);
});

test("existing matching plan retains its ID, name, description and manual ownership", async () => {
    await repository.createMissingIndexes(SUBSCRIPTION_REQUIRED_INDEXES);
    const existing = await PlanModel.create({
        ...DEFAULT_SUBSCRIPTION_PLANS[0],
        name: "Our Free plan",
        description: "Admin copy",
        isSystem: false,
    });
    await seed();
    const stored = await PlanModel.findById(existing._id).lean();
    assert.equal(stored.name, "Our Free plan");
    assert.equal(stored.description, "Admin copy");
    assert.equal(stored.isSystem, false);
});

test("existing feature and relationship IDs survive partial-catalog completion", async () => {
    await repository.createMissingIndexes(SUBSCRIPTION_REQUIRED_INDEXES);
    const plan = await PlanModel.create(DEFAULT_SUBSCRIPTION_PLANS[0]);
    const feature = await FeatureModel.create({
        ...DEFAULT_SUBSCRIPTION_FEATURES[0],
        description: "Custom workspace description",
    });
    const relation = await PlanFeatureModel.create({
        planId: plan._id,
        featureId: feature._id,
        isEnabled: true,
        limit: 0,
        limitType: "NONE",
        isUnlimited: false,
    });
    const report = await seed();
    assert.equal(report.counts.planFeatures.created, 62);
    assert.equal(String((await FeatureModel.findOne({ code: feature.code }))._id), String(feature._id));
    assert.equal((await FeatureModel.findById(feature._id)).description, "Custom workspace description");
    assert.ok(await PlanFeatureModel.findById(relation._id));
});

test("legacy duplicate stable codes abort before indexes or writes", async () => {
    await PlanModel.collection.insertMany(
        [0, 1].map(() => ({ ...DEFAULT_SUBSCRIPTION_PLANS[0], _id: new Types.ObjectId(), isDefault: false })),
    );
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply", ensureIndexes: true });
    assert.equal(report.valid, false);
    assert.match(report.conflicts.join(" "), /duplicate stable key/);
    assert.deepEqual(await snapshotAll(), before);
});

test("legacy duplicate PlanFeature keys are never merged or deleted", async () => {
    const plan = new Types.ObjectId(),
        feature = new Types.ObjectId();
    await PlanModel.collection.insertOne({ ...DEFAULT_SUBSCRIPTION_PLANS[0], _id: plan });
    await FeatureModel.collection.insertOne({ ...DEFAULT_SUBSCRIPTION_FEATURES[0], _id: feature });
    await PlanFeatureModel.collection.insertMany(
        [0, 1].map(() => ({ planId: plan, featureId: feature, isEnabled: true })),
    );
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply", ensureIndexes: true, syncDefaults: true });
    assert.equal(report.valid, false);
    assert.deepEqual(await snapshotAll(), before);
});

test("historical prices are immutable even with explicit policy synchronization", async () => {
    await seed();
    const price = await PlanPriceModel.findOne({ amountMinor: 9900 });
    await PlanPriceModel.collection.updateOne({ _id: price._id }, { $set: { amountMinor: 7900 } });
    await mongoose.connection.db.collection("usersubscriptions").insertOne({
        _id: new Types.ObjectId(),
        plan: price.planId,
        planPriceId: price._id,
        status: "active",
    });
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply", syncDefaults: true, ensureIndexes: true });
    assert.equal(report.valid, false);
    assert.match(report.conflicts.join(" "), /Historical prices/);
    assert.equal(report.referencedSubscriptions, 1);
    assert.deepEqual(await snapshotAll(), before);
});

test("unrelated default plan is preserved and conflicts with the Free default requirement", async () => {
    await repository.createMissingIndexes(SUBSCRIPTION_REQUIRED_INDEXES);
    await PlanModel.create({
        ...DEFAULT_SUBSCRIPTION_PLANS[2],
        code: "TEAM",
        isDefault: true,
        isSystem: false,
    });
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply", syncDefaults: true });
    assert.equal(report.valid, false);
    assert.match(report.conflicts.join(" "), /Unrelated plan TEAM is default/);
    assert.deepEqual(await snapshotAll(), before);
});

test("all active default plans have identical functional feature enablement", async () => {
    await seed();
    const snapshot = await repository.snapshot();
    const functions = snapshot.features.filter((feature) => feature.type === "BOOLEAN");
    const matrix = snapshot.plans.map((plan) =>
        functions.map((feature) => {
            const relation = snapshot.planFeatures.find(
                (row) =>
                    String(row.planId) === String(plan._id) && String(row.featureId) === String(feature._id),
            );
            assert.ok(relation);
            return [feature.code, relation.isEnabled, relation.limitType, relation.limit];
        }),
    );
    assert.deepEqual(matrix[0], matrix[1]);
    assert.deepEqual(matrix[1], matrix[2]);
    assert.equal(functions.filter((row) => row.isActive).length, 11);
    for (const code of ["REMINDERS", "EXPORT", "NOTE_HISTORY", "ADS_FREE"]) {
        assert.equal(functions.find((row) => row.code === code).isActive, false);
    }
});

test("quota values and byte units are exact for each billing scope", async () => {
    await seed();
    const snapshot = await repository.snapshot();
    for (const definition of DEFAULT_SUBSCRIPTION_LIMITS) {
        const feature = snapshot.features.find((row) => row.code === definition.code);
        for (const plan of snapshot.plans) {
            const relation = snapshot.planFeatures.find(
                (row) =>
                    String(row.planId) === String(plan._id) && String(row.featureId) === String(feature._id),
            );
            assert.equal(relation.limit, definition.limits[plan.code]);
            assert.ok(Number.isSafeInteger(relation.limit));
            assert.equal(relation.isUnlimited, false);
        }
    }
    assert.deepEqual(
        DEFAULT_SUBSCRIPTION_LIMITS.find((row) => row.code === "MAX_STORAGE_BYTES").values,
        [104857600, 1073741824, 10737418240],
    );
    assert.equal(
        DEFAULT_SUBSCRIPTION_LIMITS.find((row) => row.code === "MAX_FOLDERS_PER_WORKSPACE").scope,
        "WORKSPACE",
    );
});

test("globally disabled functionality stays disabled even during explicit synchronization", async () => {
    await repository.createMissingIndexes(SUBSCRIPTION_REQUIRED_INDEXES);
    await FeatureModel.create({ ...DEFAULT_SUBSCRIPTION_FEATURES[0], isActive: false });
    await seed({ syncDefaults: true });
    const feature = await FeatureModel.findOne({ code: "WORKSPACES" });
    assert.equal(feature.isActive, false);
    assert.equal(await PlanFeatureModel.countDocuments({ featureId: feature._id, isEnabled: true }), 0);
});

test("legacy numeric capability rules require explicit synchronization into separate quotas", async () => {
    await seed();
    const feature = await FeatureModel.findOne({ code: "WORKSPACES" });
    await FeatureModel.updateOne({ _id: feature._id }, { type: "QUOTA" });
    await PlanFeatureModel.updateMany({ featureId: feature._id }, { limit: 1, limitType: "COUNT" });
    const before = await snapshotAll();
    assert.equal((await service.run({ mode: "apply" })).valid, false);
    assert.deepEqual(await snapshotAll(), before);
    await seed({ syncDefaults: true });
    assert.equal((await FeatureModel.findById(feature._id)).type, "BOOLEAN");
    assert.equal(
        await PlanFeatureModel.countDocuments({ featureId: feature._id, limit: 0, limitType: "NONE" }),
        3,
    );
});

test("dry-run never creates collections, indexes or documents", async () => {
    const before = await snapshotAll();
    const report = await service.run({ mode: "dry-run" });
    assert.equal(report.valid, true);
    assert.equal(report.applied, false);
    assert.ok(report.operations.length);
    assert.deepEqual(await snapshotAll(), before);
});

test("verify detects missing records without performing writes", async () => {
    const before = await snapshotAll();
    assert.equal((await service.run({ mode: "verify" })).valid, false);
    assert.deepEqual(await snapshotAll(), before);
    await seed();
    const populated = await snapshotAll();
    assert.equal((await service.run({ mode: "verify" })).valid, true);
    assert.deepEqual(await snapshotAll(), populated);
});

test("missing constraints on a populated collection fail safely unless explicitly requested", async () => {
    await PlanModel.collection.insertOne({ ...DEFAULT_SUBSCRIPTION_PLANS[0], _id: new Types.ObjectId() });
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply" });
    assert.equal(report.valid, false);
    assert.match(report.conflicts.join(" "), /unique index is missing/);
    assert.deepEqual(await snapshotAll(), before);
    await seed({ ensureIndexes: true });
});

test("standalone interruptions preserve completed inserts and can resume idempotently", async () => {
    const original = repository.execute.bind(repository);
    const failing = mock.method(repository, "execute", async (operations) => {
        await original(operations.filter((operation) => operation.collection === "plans"));
        throw new Error("simulated interruption");
    });
    const result = await service.run({ mode: "apply" });
    failing.mock.restore();
    assert.equal(result.valid, false);
    assert.equal(result.partialWritesPossible, true);
    const ids = (await PlanModel.find().lean()).map((row) => String(row._id));
    assert.equal(ids.length, 3);
    await seed();
    assert.deepEqual(
        (await PlanModel.find().lean()).map((row) => String(row._id)),
        ids,
    );
});

test("subscriptions, payments, workspaces, folders, notes and user data are untouched", async () => {
    const protectedCollections = [
        "usersubscriptions",
        "subscriptionpayments",
        "subscriptioninvoices",
        "users",
        "workspaces",
        "workspacefolders",
        "stickynotes",
    ];
    for (const name of protectedCollections) {
        await mongoose.connection.db
            .collection(name)
            .insertOne({ _id: new Types.ObjectId(), sentinel: name, updatedAt: new Date("2025-01-01") });
    }
    const before = await snapshotAll();
    await seed();
    const after = await snapshotAll();
    for (const name of protectedCollections) assert.deepEqual(after[name], before[name]);
});

test("seeded Free integrates with idempotent user provisioning without activating paid access", async () => {
    await seed();
    const user = await UserModel.create({
        email: "seed-test@example.test",
        globalRoleId: new Types.ObjectId(),
        status: "ACTIVE",
    });
    const subscriptions = new UserSubscriptionService();
    const first = await subscriptions.ensureFreeSubscription(String(user._id));
    const second = await subscriptions.ensureFreeSubscription(String(user._id));
    assert.equal(String(first._id), String(second._id));
    assert.equal(first.planPriceId, null);
    assert.equal(String(first.plan), String((await PlanModel.findOne({ code: "FREE" }))._id));
});

test("production CLI is read-only by default and rejects ambiguous or unsafe flags", async () => {
    assert.equal(parseSubscriptionSeedArguments([]).mode, "dry-run");
    assert.throws(() => parseSubscriptionSeedArguments(["--force"]));
    assert.throws(() => parseSubscriptionSeedArguments(["--apply", "--dry-run"]));
    assert.throws(() => parseSubscriptionSeedArguments(["--verify", "--sync-defaults"]));
    const before = await snapshotAll();
    const result = await command([], { NODE_ENV: "production" });
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /DRY-RUN/);
    assert.ok(!result.output.includes(uri));
    assert.deepEqual(await snapshotAll(), before);
    const bad = await command(["--force"], { NODE_ENV: "production" });
    assert.equal(bad.code, 1);
    assert.deepEqual(await snapshotAll(), before);
    const applied = await command(["--apply"], { NODE_ENV: "production" });
    assert.equal(applied.code, 0, applied.output);
    assert.match(applied.output, /COMPLETED/);
});

test("unrelated active plans are not silently changed to achieve feature parity", async () => {
    await seed();
    await PlanModel.create({
        ...DEFAULT_SUBSCRIPTION_PLANS[2],
        code: "TEAM",
        isSystem: false,
        description: "Admin-controlled team policy",
    });
    const before = await snapshotAll();
    const report = await service.run({ mode: "apply", syncDefaults: true });
    assert.equal(report.valid, false);
    assert.match(report.conflicts.join(" "), /Unrelated active plan TEAM/);
    assert.deepEqual(await snapshotAll(), before);
});

test("noncanonical codes and orphaned relationships require reviewed migration", async () => {
    await PlanModel.collection.insertOne({ code: "free", name: "Legacy", isDefault: false });
    await PlanFeatureModel.collection.insertOne({
        planId: new Types.ObjectId(),
        featureId: new Types.ObjectId(),
    });
    const before = await snapshotAll();
    const result = await service.run({ mode: "apply", ensureIndexes: true });
    assert.equal(result.valid, false);
    assert.match(result.conflicts.join(" "), /noncanonical/);
    assert.match(result.conflicts.join(" "), /Orphaned/);
    assert.deepEqual(await snapshotAll(), before);
});

test("invalid quota configuration is rejected before any database operation", async () => {
    const definition = DEFAULT_SUBSCRIPTION_LIMITS[0];
    const previous = definition.limits.FREE;
    definition.limits.FREE = 1.5;
    try {
        assert.throws(() => service.validateConfiguration(), /configuration is invalid/);
    } finally {
        definition.limits.FREE = previous;
    }
});

test("legacy standalone seeder entry points cannot overwrite the new catalog", async () => {
    await seed();
    const before = await snapshotAll();
    const { seedPlanPrices } = await import("../src/modules/planprice/seeders/planPrice.seeder.ts");
    const { seedPlans } = await import("../src/modules/plan/seeders/plan.seeder.ts");
    await assert.rejects(seedPlanPrices(), /Legacy subscription seeding is disabled/);
    await assert.rejects(seedPlans(), /Legacy subscription seeding is disabled/);
    assert.deepEqual(await snapshotAll(), before);
});

test("explicitly switching the default within managed plans respects the unique index", async () => {
    await seed();
    await PlanModel.updateOne({ code: "FREE" }, { isDefault: false });
    await PlanModel.updateOne({ code: "PRO" }, { isDefault: true });
    await seed({ syncDefaults: true });
    assert.equal(await PlanModel.countDocuments({ isDefault: true }), 1);
    assert.equal((await PlanModel.findOne({ isDefault: true })).code, "FREE");
});

test("replica-set execution uses transactions and rolls back an interrupted document phase", async () => {
    const replica = await startMongo(true);
    await connect(replica.base + "/transaction_test?directConnection=true");
    const original = repository.execute.bind(repository);
    const failing = mock.method(repository, "execute", async (operations, session) => {
        assert.ok(session);
        await original(
            operations.filter((operation) => operation.collection === "plans"),
            session,
        );
        throw new Error("transaction interrupted");
    });
    const failed = await service.run({ mode: "apply" });
    failing.mock.restore();
    assert.equal(failed.valid, false);
    assert.equal(failed.transactions, true);
    assert.equal(await PlanModel.countDocuments(), 0);
    const result = await seed();
    assert.equal(result.transactions, true);
    assert.equal(await PlanModel.countDocuments(), 3);
});
