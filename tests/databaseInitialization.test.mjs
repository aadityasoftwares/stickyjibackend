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

import { DatabaseInitializer } from "../src/database/initialization/database-initializer.ts";
import { InitializationLockManager, InitializationLockModel } from "../src/database/initialization/initialization-lock.ts";
import { InitializationStateModel, InitializationStatus } from "../src/database/initialization/initialization-state.model.ts";
import { LanguageModel } from "../src/modules/languages/models/language.model.ts";
import { CountryModel } from "../src/modules/countries/models/country.model.ts";
import { CurrencyModel } from "../src/modules/currency/models/currency.model.ts";
import { TimezoneModel } from "../src/modules/timezones/models/timezone.model.ts";
import { SystemSettingModel } from "../src/modules/systemsettings/models/systemSetting.model.ts";
import { SYSTEM_SETTING_DEFAULTS } from "../src/modules/systemsettings/constants/systemSetting.constants.ts";
import { PermissionModel } from "../src/modules/permissions/models/permission.model.ts";
import { PERMISSION_DEFINITIONS } from "../src/modules/permissions/constants/permission.constants.ts";
import { RoleModel } from "../src/modules/roles/models/role.model.ts";
import { SYSTEM_ROLE_CODES } from "../src/modules/roles/constants/role.constants.ts";
import { PlanModel } from "../src/modules/plan/models/plan.model.ts";
import { FeatureModel } from "../src/modules/feature/models/feature.model.ts";
import { PlanFeatureModel } from "../src/modules/planfeature/models/planfeature.model.ts";
import { PlanPriceModel } from "../src/modules/planprice/models/planPrice.model.ts";
import { SubscriptionSeedService } from "../src/seeders/subscription/services/subscription-seed.service.ts";

const processes = [];
let mongo, uri;

async function connect(target) {
    await mongoose.disconnect();
    await mongoose.connect(target, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 2000 });
}

async function startMongo(replicaSet = false) {
    const socket = createServer().listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const directory = await mkdtemp(join(tmpdir(), "db-init-test-"));
    const process = spawn(globalThis.process.env.MONGOD_BINARY ?? "mongod", [
        "--dbpath", directory, "--port", String(port), "--bind_ip", "127.0.0.1",
        "--logpath", join(directory, "mongo.log"), ...(replicaSet ? ["--replSet", "db-init-set"] : []),
    ], { windowsHide: true, stdio: "ignore" });
    const result = { process, directory, base: "mongodb://127.0.0.1:" + port };
    processes.push(result);
    let startupError;
    process.on("error", error => { startupError = error; });
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
            replSetInitiate: { _id: "db-init-set", members: [{ _id: 0, host: "127.0.0.1:" + port }] },
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
    uri = mongo.base + "/init_" + new Types.ObjectId();
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
        assert.ok(basename(target).startsWith("db-init-test-"));
        await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
});

// Helper for running CLI commands
async function runCli(scriptPath, args = [], environment = {}) {
    const child = spawn(process.execPath, ["--import", "tsx", scriptPath, ...args], {
        windowsHide: true,
        env: { ...process.env, MONGO_URI: uri, ...environment },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    const [code] = await once(child, "exit");
    return { code, output };
}

test("1. empty database initialization succeeds and marks status COMPLETED", async () => {
    const initializer = new DatabaseInitializer();
    assert.equal(await initializer.isInitialized(), false);

    const report = await initializer.initialize();
    assert.equal(report.initialized, true);
    assert.equal(report.version, 1);
    assert.equal(report.skipped ?? false, false);
    assert.equal(await initializer.isInitialized(), true);

    const state = await InitializationStateModel.findOne({ version: 1 }).lean();
    assert.ok(state);
    assert.equal(state.status, InitializationStatus.COMPLETED);
    assert.ok(state.completedAt);
});

test("2. all required system records are created correctly", async () => {
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    // Languages
    const lang = await LanguageModel.findOne({ code: "en" }).lean();
    assert.ok(lang);
    assert.equal(lang.isDefault, true);

    // Countries
    const country = await CountryModel.findOne({ code: "IN" }).lean();
    assert.ok(country);
    assert.equal(country.currencyCode, "INR");

    // Currencies
    const currency = await CurrencyModel.findOne({ code: "INR" }).lean();
    assert.ok(currency);
    assert.equal(currency.numericCode, "356");

    // Timezones
    const tz = await TimezoneModel.findOne({ code: "Asia/Kolkata" }).lean();
    assert.ok(tz);

    // System Settings
    const settingCount = await SystemSettingModel.countDocuments();
    assert.equal(settingCount, SYSTEM_SETTING_DEFAULTS.length);

    // Permissions
    const permCount = await PermissionModel.countDocuments({ isSystem: true });
    assert.equal(permCount, PERMISSION_DEFINITIONS.length);

    // Roles
    const roles = await RoleModel.find({ isSystem: true }).lean();
    assert.equal(roles.length, Object.keys(SYSTEM_ROLE_CODES).length);
    const superAdmin = roles.find(r => r.code === "SUPER_ADMIN");
    assert.ok(superAdmin);
    assert.equal(superAdmin.permissions.length, PERMISSION_DEFINITIONS.length);

    // Subscription Catalog
    assert.equal(await PlanModel.countDocuments({ isActive: true }), 3);
    assert.equal(await FeatureModel.countDocuments(), 21);
    assert.equal(await FeatureModel.countDocuments({ isActive: true }), 17);
    assert.equal(await PlanFeatureModel.countDocuments(), 63);
    assert.equal(await PlanPriceModel.countDocuments({ isActive: true }), 4);

    // Verification check
    const verification = await initializer.verify();
    assert.equal(verification.valid, true);
    assert.equal(verification.errors.length, 0);
});

test("3. second initialization makes no unnecessary changes and skips seeding", async () => {
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    // Capture counts before second run
    const langCountBefore = await LanguageModel.countDocuments();
    const permCountBefore = await PermissionModel.countDocuments();
    const planCountBefore = await PlanModel.countDocuments();

    // Run again without force
    const report2 = await initializer.initialize();
    assert.equal(report2.initialized, true);
    assert.equal(report2.skipped, true);

    // Counts remain identical
    assert.equal(await LanguageModel.countDocuments(), langCountBefore);
    assert.equal(await PermissionModel.countDocuments(), permCountBefore);
    assert.equal(await PlanModel.countDocuments(), planCountBefore);
});

test("4. no duplicate plans, features, prices, roles, or permissions are created on rerun", async () => {
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    // Run with force=true to simulate rerun
    await initializer.initialize({ force: true });

    assert.equal(await PlanModel.countDocuments({ code: "FREE" }), 1);
    assert.equal(await PlanModel.countDocuments({ code: "INDIVIDUAL" }), 1);
    assert.equal(await PlanModel.countDocuments({ code: "PRO" }), 1);
    assert.equal(await PermissionModel.countDocuments(), PERMISSION_DEFINITIONS.length);
    assert.equal(await RoleModel.countDocuments({ isSystem: true }), Object.keys(SYSTEM_ROLE_CODES).length);
    assert.equal(await PlanPriceModel.countDocuments(), 4);
});

test("5. existing customer data remains untouched", async () => {
    // Insert mock customer data
    const customerCollections = [
        "users",
        "workspaces",
        "workspacefolders",
        "stickynotes",
        "userpreferences",
        "sessions",
        "auditlogs",
    ];

    for (const name of customerCollections) {
        await mongoose.connection.db.collection(name).insertOne({
            _id: new Types.ObjectId(),
            sentinel: `test_${name}`,
            createdAt: new Date("2025-01-01"),
        });
    }

    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    for (const name of customerCollections) {
        const found = await mongoose.connection.db.collection(name).findOne({ sentinel: `test_${name}` });
        assert.ok(found, `Customer document in ${name} was deleted or lost`);
        assert.equal(found.sentinel, `test_${name}`);
    }
});

test("6. existing paid subscription records remain unchanged", async () => {
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    const plan = await PlanModel.findOne({ code: "INDIVIDUAL" });
    const price = await PlanPriceModel.findOne({ planId: plan._id });

    const subscriptionDoc = {
        _id: new Types.ObjectId(),
        plan: plan._id,
        planPriceId: price._id,
        status: "active",
        createdAt: new Date("2025-06-01"),
    };
    await mongoose.connection.db.collection("usersubscriptions").insertOne(subscriptionDoc);

    const paymentDoc = {
        _id: new Types.ObjectId(),
        amount: 4900,
        currency: "INR",
        status: "COMPLETED",
    };
    await mongoose.connection.db.collection("subscriptionpayments").insertOne(paymentDoc);

    // Rerun initializer with force
    await initializer.initialize({ force: true });

    const subAfter = await mongoose.connection.db.collection("usersubscriptions").findOne({ _id: subscriptionDoc._id });
    assert.deepEqual(subAfter, subscriptionDoc);

    const paymentAfter = await mongoose.connection.db.collection("subscriptionpayments").findOne({ _id: paymentDoc._id });
    assert.deepEqual(paymentAfter, paymentDoc);
});

test("7. existing custom roles remain untouched", async () => {
    const customRole = await RoleModel.create({
        name: "custom-editor",
        displayName: "Custom Workspace Editor",
        code: "CUSTOM_WORKSPACE_EDITOR",
        description: "Custom role created by workspace owner",
        type: "CUSTOM",
        scope: "WORKSPACE",
        workspaceId: new Types.ObjectId(),
        permissions: [],
        isSystem: false,
        isDefault: false,
        priority: 25,
        isActive: true,
    });

    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    const foundCustom = await RoleModel.findById(customRole._id).lean();
    assert.ok(foundCustom);
    assert.equal(foundCustom.name, "custom-editor");
    assert.equal(foundCustom.isSystem, false);
});

test("8. partial initialization can recover safely and idempotently", async () => {
    // Partially initialize: only seed languages and countries
    const { executeLanguagesSeed } = await import("../src/database/initialization/seeds/languages.seed.ts");
    const { executeCountriesSeed } = await import("../src/database/initialization/seeds/countries.seed.ts");
    await executeLanguagesSeed();
    await executeCountriesSeed();

    assert.equal(await LanguageModel.countDocuments(), 1);
    assert.equal(await CountryModel.countDocuments(), 1);
    assert.equal(await PlanModel.countDocuments(), 0);

    // Now run full database initializer
    const initializer = new DatabaseInitializer();
    const report = await initializer.initialize();
    assert.equal(report.initialized, true);

    // Verify all records were completed
    const verification = await initializer.verify();
    assert.equal(verification.valid, true);
    assert.equal(await PlanModel.countDocuments(), 3);
});

test("9. missing database connection causes a clear error", async () => {
    await mongoose.disconnect();
    const initializer = new DatabaseInitializer();
    await assert.rejects(
        () => initializer.initialize(),
        /Database connection is not open/
    );
});

test("10. two backend instances initializing concurrently coordinate via distributed lock", async () => {
    const lockManager = new InitializationLockManager();
    const initializer1 = new DatabaseInitializer(lockManager);
    const initializer2 = new DatabaseInitializer(lockManager);

    // Run both initialize concurrently
    const [report1, report2] = await Promise.all([
        initializer1.initialize({ runnerId: "instance_1" }),
        initializer2.initialize({ runnerId: "instance_2" }),
    ]);

    assert.equal(report1.initialized, true);
    assert.equal(report2.initialized, true);

    // One must have executed, the other waited or skipped
    const oneExecuted = (report1.skipped ?? false) === false || (report2.skipped ?? false) === false;
    assert.equal(oneExecuted, true);

    // Verify database state is valid and clean
    const verification = await initializer1.verify();
    assert.equal(verification.valid, true);
    assert.equal(await PlanModel.countDocuments(), 3);
    assert.equal(await RoleModel.countDocuments({ isSystem: true }), Object.keys(SYSTEM_ROLE_CODES).length);
});

test("11. a failed initialization is marked FAILED and never marked COMPLETED", async () => {
    const initializer = new DatabaseInitializer();
    const { SEED_REGISTRY } = await import("../src/database/initialization/seed-registry.ts");

    // Mock a seed step to throw an error
    const originalRoleExecute = SEED_REGISTRY.find(s => s.id === "roles").execute;
    const mockedRoleStep = mock.method(
        SEED_REGISTRY.find(s => s.id === "roles"),
        "execute",
        async () => {
            throw new Error("Simulated database failure during roles seeding");
        }
    );

    await assert.rejects(
        () => initializer.initialize(),
        /Simulated database failure/
    );

    mockedRoleStep.mock.restore();

    const state = await InitializationStateModel.findOne({ version: 1 }).lean();
    assert.ok(state);
    assert.equal(state.status, InitializationStatus.FAILED);
    assert.match(state.error, /Simulated database failure/);
    assert.equal(await initializer.isInitialized(), false);

    // Verify recovery after failure
    const recoveryReport = await initializer.initialize();
    assert.equal(recoveryReport.initialized, true);
    assert.equal(await initializer.isInitialized(), true);
});

test("12. existing manual subscription seed scripts remain compatible", async () => {
    // Run db:init first
    const initializer = new DatabaseInitializer();
    await initializer.initialize();

    // Now run subscription seeder in verify mode
    const subscriptionService = new SubscriptionSeedService();
    const verifyReport = await subscriptionService.run({ mode: "verify" });
    assert.equal(verifyReport.valid, true);
    assert.equal(verifyReport.errors.length, 0);

    // Run subscription seeder CLI via child process in verify mode
    const cliVerify = await runCli("src/scripts/seed-default-subscriptions.ts", ["--verify"]);
    assert.equal(cliVerify.code, 0, cliVerify.output);
    assert.match(cliVerify.output, /VERIFY/);

    // Run subscription seeder CLI in dry-run mode
    const cliDryRun = await runCli("src/scripts/seed-default-subscriptions.ts", ["--dry-run"]);
    assert.equal(cliDryRun.code, 0, cliDryRun.output);
    assert.match(cliDryRun.output, /DRY-RUN/);
});

test("13. CLI commands db:init and db:init:verify function properly", async () => {
    // Test db:init:verify on empty database -> fails with exit code 1
    const verifyBefore = await runCli("src/scripts/verify-database-initialization.ts");
    assert.equal(verifyBefore.code, 1);
    assert.match(verifyBefore.output, /NOT COMPLETED/);

    // Test db:init -> succeeds with exit code 0
    const initRun = await runCli("src/scripts/initialize-database.ts");
    assert.equal(initRun.code, 0, initRun.output);
    assert.match(initRun.output, /initialized: true/);

    // Test db:init:verify on initialized database -> succeeds with exit code 0
    const verifyAfter = await runCli("src/scripts/verify-database-initialization.ts");
    assert.equal(verifyAfter.code, 0, verifyAfter.output);
    assert.match(verifyAfter.output, /COMPLETED/);
    assert.match(verifyAfter.output, /PASSED/);
});
