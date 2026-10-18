import { Types } from "mongoose";
import { z } from "zod";
import { AppError } from "../../../utils/errors/app.error.js";
import {
    FeatureCode,
    FeatureCategory,
    FeatureType,
} from "../../../modules/feature/constants/feature.enums.js";
import {
    PlanCode,
    PlanPricingModel,
    PlanType,
    PlanVisibility,
} from "../../../modules/plan/constants/plan.enums.js";
import { BillingInterval } from "../../../modules/planprice/constants/planPrice.enums.js";
import { PlanFeatureLimitType } from "../../../modules/planfeature/constants/planFeature.enums.js";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../constants/default-plans.constants.js";
import { DEFAULT_SUBSCRIPTION_FEATURES } from "../constants/default-features.constants.js";
import {
    DEFAULT_SUBSCRIPTION_LIMITS,
    type DefaultSubscriptionPlanCode,
} from "../constants/default-limits.constants.js";
import {
    DEFAULT_SUBSCRIPTION_PRICES,
    FREE_SUBSCRIPTION_PRICING,
    SUBSCRIPTION_SEED_CURRENCY,
} from "../constants/default-plan-prices.constants.js";
import { SUBSCRIPTION_SEED_CONSTANTS } from "../constants/subscription-seed.constants.js";
import { SubscriptionSeedRepository } from "../repositories/subscription-seed.repository.js";
import type {
    SeedCollection,
    SeedDocument,
    SeedSnapshot,
    SubscriptionSeedOptions,
    SubscriptionSeedReport,
} from "../interfaces/subscription-seed.interface.js";

const optionsSchema = z.strictObject({
    mode: z.enum(["dry-run", "verify", "apply"]),
    syncDefaults: z.boolean().default(false),
    ensureIndexes: z.boolean().default(false),
});

export class SubscriptionSeedService {
    constructor(private readonly repository = new SubscriptionSeedRepository()) {}

    validateConfiguration(): void {
        const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
        const plans = z
            .array(
                z.object({
                    code: z.enum(PlanCode),
                    name: z.string().min(1),
                    description: z.string().min(1),
                    type: z.enum(PlanType),
                    pricingModel: z.enum(PlanPricingModel),
                    visibility: z.enum(PlanVisibility),
                    isDefault: z.boolean(),
                    isActive: z.literal(true),
                    trialDays: integer,
                }),
            )
            .safeParse(DEFAULT_SUBSCRIPTION_PLANS);
        const features = z
            .array(
                z.object({
                    code: z.enum(FeatureCode),
                    name: z.string().min(1),
                    description: z.string().min(1),
                    category: z.enum(FeatureCategory),
                    type: z.literal(FeatureType.BOOLEAN),
                    isActive: z.boolean(),
                }),
            )
            .safeParse(DEFAULT_SUBSCRIPTION_FEATURES);
        const limits = z
            .array(
                z.object({
                    code: z.enum(FeatureCode),
                    type: z.literal(FeatureType.QUOTA),
                    limitType: z.enum(PlanFeatureLimitType),
                    limits: z.object({ FREE: integer, INDIVIDUAL: integer, PRO: integer }),
                }),
            )
            .safeParse(DEFAULT_SUBSCRIPTION_LIMITS);
        const prices = z
            .array(
                z.object({
                    planCode: z.enum([PlanCode.INDIVIDUAL, PlanCode.PRO]),
                    billingInterval: z.enum(BillingInterval),
                    amountMinor: integer.refine((value) => value > 0),
                }),
            )
            .safeParse(DEFAULT_SUBSCRIPTION_PRICES);
        const codes = [...DEFAULT_SUBSCRIPTION_FEATURES, ...DEFAULT_SUBSCRIPTION_LIMITS].map(
            (item) => item.code,
        );
        const priceKeys = DEFAULT_SUBSCRIPTION_PRICES.map(
            (item) => item.planCode + ":" + item.billingInterval,
        );
        if (
            !plans.success ||
            !features.success ||
            !limits.success ||
            !prices.success ||
            new Set(codes).size !== codes.length ||
            new Set(priceKeys).size !== 4 ||
            DEFAULT_SUBSCRIPTION_PLANS.filter((plan) => plan.isDefault).length !== 1 ||
            !DEFAULT_SUBSCRIPTION_PLANS.find((plan) => plan.code === PlanCode.FREE)?.isDefault ||
            DEFAULT_SUBSCRIPTION_PLANS.length !== 3 ||
            new Set(DEFAULT_SUBSCRIPTION_PLANS.map((plan) => plan.code)).size !== 3
        ) {
            throw new AppError(SUBSCRIPTION_SEED_CONSTANTS.CONFIG_INVALID, 400);
        }
    }

    async run(input: SubscriptionSeedOptions): Promise<SubscriptionSeedReport> {
        this.validateConfiguration();
        const options = optionsSchema.parse(input);
        const snapshot = await this.repository.snapshot();
        const report = this.plan(snapshot, options);
        const missing = await this.repository.missingIndexes();
        report.missingIndexes = missing.map((index) => index.collection + "." + index.name);
        for (const index of missing) {
            if (snapshot[index.collection].length && !options.ensureIndexes) {
                report.conflicts.push(
                    index.collection + "." + index.name + ": " + SUBSCRIPTION_SEED_CONSTANTS.INDEX_REPAIR,
                );
            }
        }
        report.referencedSubscriptions = await this.repository.countReferencedSubscriptions(
            snapshot.plans.filter((plan) =>
                DEFAULT_SUBSCRIPTION_PLANS.some((defaultPlan) => defaultPlan.code === plan.code),
            ),
        );
        if (options.mode === "verify") {
            if (report.operations.length)
                report.errors.push(
                    "Required records or relationships are missing or differ from configuration.",
                );
            if (missing.length) report.errors.push("Required database indexes are missing.");
            report.valid = !report.conflicts.length && !report.errors.length;
            return report;
        }
        report.valid = !report.conflicts.length;
        if (options.mode !== "apply" || !report.valid) return report;

        try {
            // Index creation is explicit and never part of dry-run/verify.
            // Existing duplicates were rejected by planning before any index/write attempt.
            await this.repository.createMissingIndexes(missing);
            report.transactions = await this.repository.supportsTransactions();
            const apply = async (session?: import("mongoose").ClientSession) => {
                await this.repository.execute(report.operations, session);
                const verified = this.plan(await this.repository.snapshot(session), {
                    ...options,
                    syncDefaults: false,
                });
                if (verified.conflicts.length || verified.operations.length) {
                    throw new AppError(
                        "Post-seed verification failed; inspect the configuration and rerun dry-run.",
                        409,
                    );
                }
            };
            if (report.transactions) {
                await this.repository.transaction(apply);
            } else {
                report.partialWritesPossible = report.operations.length > 0;
                await apply();
            }
            // Verify durable committed data as well, not just bulk-write counters.
            const final = this.plan(await this.repository.snapshot(), { ...options, syncDefaults: false });
            if (
                final.conflicts.length ||
                final.operations.length ||
                (await this.repository.missingIndexes()).length
            ) {
                throw new AppError(
                    "Committed configuration failed verification. Rerun verify and inspect conflicts.",
                    409,
                );
            }
            report.applied = true;
            report.partialWritesPossible = false;
        } catch (error) {
            report.valid = false;
            report.errors.push(
                error instanceof AppError
                    ? error.message
                    : "Database write or index operation failed. Inspect server logs and rerun dry-run; no price amount was overwritten.",
            );
        }
        return report;
    }

    private plan(snapshot: SeedSnapshot, options: SubscriptionSeedOptions): SubscriptionSeedReport {
        const report: SubscriptionSeedReport = {
            mode: options.mode,
            valid: false,
            applied: false,
            partialWritesPossible: false,
            transactions: false,
            counts: {
                plans: this.emptyCounts(),
                features: this.emptyCounts(),
                planFeatures: this.emptyCounts(),
                planPrices: this.emptyCounts(),
                currencies: this.emptyCounts(),
            },
            operations: [],
            conflicts: [],
            errors: [],
            missingIndexes: [],
            referencedSubscriptions: 0,
            freePricing: FREE_SUBSCRIPTION_PRICING,
        };
        this.checkIntegrity(snapshot, report);
        if (report.conflicts.length) return report;
        const plans = new Map<string, SeedDocument>();
        const features = new Map<string, SeedDocument>();
        const defaultCodes = new Set<string>(DEFAULT_SUBSCRIPTION_PLANS.map((plan) => plan.code));

        for (const definition of DEFAULT_SUBSCRIPTION_PLANS) {
            const existing = snapshot.plans.find((plan) => plan.code === definition.code);
            const plan = this.record(
                report,
                options,
                "plans",
                definition.code,
                { code: definition.code },
                definition,
                existing,
                ["type", "pricingModel", "visibility", "isDefault", "isActive", "trialDays"],
            );
            plans.set(definition.code, plan);
        }
        // Preserve unrelated plans. Their functional parity is verified below without modifying them.
        for (const existing of snapshot.plans) {
            if (!defaultCodes.has(String(existing.code))) {
                if (existing.isDefault)
                    report.conflicts.push(
                        "Unrelated plan " +
                            existing.code +
                            " is default; resolve it explicitly before selecting FREE.",
                    );
                if (existing.isActive) plans.set(String(existing.code), existing);
                report.counts.plans.skipped++;
            }
        }

        for (const definition of DEFAULT_SUBSCRIPTION_FEATURES) {
            const existing = snapshot.features.find((feature) => feature.code === definition.code);
            const desired = {
                ...definition,
                // Never reactivate an administrator's globally disabled capability.
                isActive: definition.isActive && existing?.isActive !== false,
            };
            const feature = this.record(
                report,
                options,
                "features",
                definition.code,
                { code: definition.code },
                desired,
                existing,
                ["type", "category", "isActive"],
            );
            features.set(definition.code, feature);
        }
        for (const definition of DEFAULT_SUBSCRIPTION_LIMITS) {
            const { code, name, description, category, type, isActive, isDefault, isSystem } = definition;
            const existing = snapshot.features.find((feature) => feature.code === code);
            if (existing?.isActive === false)
                report.conflicts.push(
                    code +
                        " is globally disabled; review its configuration rather than silently re-enabling a quota.",
                );
            const feature = this.record(
                report,
                options,
                "features",
                code,
                { code },
                { code, name, description, category, type, isActive, isDefault, isSystem },
                existing,
                ["type", "category", "isActive"],
            );
            features.set(code, feature);
        }
        for (const existing of snapshot.features) {
            if (!features.has(String(existing.code))) {
                features.set(String(existing.code), existing);
                report.counts.features.skipped++;
            }
        }

        const inr = this.record(
            report,
            options,
            "currencies",
            SUBSCRIPTION_SEED_CURRENCY.code,
            { code: SUBSCRIPTION_SEED_CURRENCY.code },
            SUBSCRIPTION_SEED_CURRENCY,
            snapshot.currencies.find((currency) => currency.code === SUBSCRIPTION_SEED_CURRENCY.code),
            ["numericCode", "decimalPlaces", "type", "isActive"],
            true,
        );
        for (const currency of snapshot.currencies) {
            if (currency.code !== SUBSCRIPTION_SEED_CURRENCY.code) report.counts.currencies.skipped++;
            if (
                currency.numericCode === SUBSCRIPTION_SEED_CURRENCY.numericCode &&
                currency.code !== SUBSCRIPTION_SEED_CURRENCY.code
            ) {
                report.conflicts.push("Currency numeric code 356 is already assigned to another currency.");
            }
        }

        const functional = [...features.values()].filter((feature) => feature.type === FeatureType.BOOLEAN);
        for (const plan of plans.values()) {
            const isDefaultPlan = defaultCodes.has(String(plan.code));
            for (const feature of functional) {
                this.association(
                    snapshot,
                    report,
                    options,
                    plan,
                    feature,
                    {
                        isEnabled: feature.isActive === true,
                        limit: 0,
                        limitType: PlanFeatureLimitType.NONE,
                        isUnlimited: false,
                    },
                    isDefaultPlan,
                );
            }
            if (!isDefaultPlan) continue;
            for (const definition of DEFAULT_SUBSCRIPTION_LIMITS) {
                const feature = features.get(definition.code)!;
                this.association(
                    snapshot,
                    report,
                    options,
                    plan,
                    feature,
                    {
                        isEnabled: true,
                        limit: definition.limits[plan.code as DefaultSubscriptionPlanCode],
                        limitType: definition.limitType,
                        isUnlimited: false,
                    },
                    true,
                );
            }
        }

        for (const price of DEFAULT_SUBSCRIPTION_PRICES) {
            const plan = plans.get(price.planCode)!;
            const filter = { planId: plan._id, currencyId: inr._id, billingInterval: price.billingInterval };
            const existing = snapshot.planPrices.find((row) => this.matches(row, filter));
            this.record(
                report,
                options,
                "planPrices",
                price.planCode + "/" + price.billingInterval,
                filter,
                { ...filter, amountMinor: price.amountMinor, sortOrder: price.sortOrder, isActive: true },
                existing,
                ["amountMinor", "isActive"],
                true,
            );
        }
        report.counts.planPrices.skipped += 2; // Explicitly represented FREE monthly/yearly zero pricing.
        const freeId = plans.get(PlanCode.FREE)!._id;
        if (snapshot.planPrices.some((price) => String(price.planId) === String(freeId))) {
            report.conflicts.push(
                "FREE has legacy PlanPrice records. Review them explicitly; this schema uses implicit zero pricing.",
            );
        }
        return report;
    }

    private association(
        snapshot: SeedSnapshot,
        report: SubscriptionSeedReport,
        options: SubscriptionSeedOptions,
        plan: SeedDocument,
        feature: SeedDocument,
        rule: Record<string, unknown>,
        managed: boolean,
    ): void {
        const filter = { planId: plan._id, featureId: feature._id };
        const existing = snapshot.planFeatures.find((row) => this.matches(row, filter));
        const key = String(plan.code) + "/" + String(feature.code);
        if (!managed) {
            report.counts.planFeatures.skipped++;
            if (!existing || !this.matches(existing, rule)) {
                report.conflicts.push(
                    "Unrelated active plan " +
                        plan.code +
                        " lacks equal functionality for " +
                        feature.code +
                        ". Align it explicitly; the seeder will not modify unrelated plans or their associations.",
                );
            }
            return;
        }
        // Custom associations are never reset implicitly. --sync-defaults explicitly opts into
        // known default-plan rule changes; display metadata on parent records remains preserved.
        this.record(
            report,
            options,
            "planFeatures",
            key,
            filter,
            { ...filter, ...rule, sortOrder: 0 },
            existing,
            ["isEnabled", "limit", "limitType", "isUnlimited"],
        );
    }

    private record(
        report: SubscriptionSeedReport,
        options: SubscriptionSeedOptions,
        collection: SeedCollection,
        key: string,
        filter: Record<string, unknown>,
        desired: Record<string, unknown>,
        existing: SeedDocument | undefined,
        policyFields: string[],
        immutable = false,
    ): SeedDocument {
        if (!existing) {
            const values = { _id: new Types.ObjectId(), ...desired, createdBy: null, updatedBy: null };
            report.operations.push({ collection, key, action: "create", filter, values });
            report.counts[collection].created++;
            return values;
        }
        const changes = Object.fromEntries(
            policyFields
                .filter((field) => !this.equal(existing[field], desired[field]))
                .map((field) => [field, desired[field]]),
        );
        if (!Object.keys(changes).length) {
            report.counts[collection].unchanged++;
            return existing;
        }
        const canSynchronize =
            options.syncDefaults &&
            !immutable &&
            (collection === "planFeatures" || existing.isSystem === true);
        if (!canSynchronize) {
            const message =
                collection === "planPrices"
                    ? SUBSCRIPTION_SEED_CONSTANTS.PRICE_CONFLICT
                    : immutable
                      ? "Existing supporting configuration must be reviewed manually."
                      : existing.isSystem === false && collection !== "planFeatures"
                        ? "Manually managed record differs; review it explicitly."
                        : "Review a dry-run with --sync-defaults to synchronize known default policy fields.";
            report.conflicts.push(
                collection + " " + key + " differs in " + Object.keys(changes).join(", ") + ". " + message,
            );
            return existing;
        }
        const expected: Record<string, unknown> = { _id: existing._id };
        for (const field of [...policyFields, "updatedAt"]) {
            expected[field] = existing[field] === undefined ? { $exists: false } : existing[field];
        }
        report.operations.push({ collection, key, action: "update", filter: expected, values: changes });
        report.counts[collection].updated++;
        return { ...existing, ...changes };
    }

    private checkIntegrity(snapshot: SeedSnapshot, report: SubscriptionSeedReport): void {
        const keys: Record<SeedCollection, string[][]> = {
            plans: [["code"]],
            features: [["code"]],
            planFeatures: [["planId", "featureId"]],
            planPrices: [["planId", "currencyId", "billingInterval"]],
            currencies: [["code"], ["numericCode"]],
        };
        for (const collection of SUBSCRIPTION_SEED_CONSTANTS.COLLECTIONS) {
            for (const fields of keys[collection]) {
                const seen = new Set<string>();
                for (const row of snapshot[collection]) {
                    if (
                        fields.includes("code") &&
                        (typeof row.code !== "string" || row.code !== row.code.trim().toUpperCase())
                    ) {
                        report.conflicts.push(
                            collection +
                                " contains a noncanonical code. Review its stable identity before seeding.",
                        );
                    }
                    const key = fields.map((field) => String(row[field])).join("/");
                    if (fields.some((field) => row[field] == null) || seen.has(key)) {
                        report.conflicts.push(
                            collection +
                                " has missing or duplicate stable key " +
                                fields.join("/") +
                                "=" +
                                key +
                                ". A separate reviewed migration is required; no merging or deletion is performed.",
                        );
                    }
                    seen.add(key);
                }
            }
        }
        if (snapshot.plans.filter((plan) => plan.isDefault).length > 1) {
            report.conflicts.push("Multiple default plans exist. Resolve them in a reviewed migration.");
        }
        const planIds = new Set(snapshot.plans.map((row) => String(row._id)));
        const featureIds = new Set(snapshot.features.map((row) => String(row._id)));
        const currencyIds = new Set(snapshot.currencies.map((row) => String(row._id)));
        if (
            snapshot.planFeatures.some(
                (row) => !planIds.has(String(row.planId)) || !featureIds.has(String(row.featureId)),
            )
        ) {
            report.conflicts.push("Orphaned PlanFeature relationships exist. Review them before seeding.");
        }
        if (
            snapshot.planPrices.some(
                (row) => !planIds.has(String(row.planId)) || !currencyIds.has(String(row.currencyId)),
            )
        ) {
            report.conflicts.push("Orphaned PlanPrice relationships exist. Review them before seeding.");
        }
    }

    private matches(row: SeedDocument, fields: Record<string, unknown>): boolean {
        return Object.entries(fields).every(([field, value]) => this.equal(row[field], value));
    }

    private equal(left: unknown, right: unknown): boolean {
        if (left instanceof Types.ObjectId || right instanceof Types.ObjectId)
            return String(left) === String(right);
        return left === right;
    }

    private emptyCounts() {
        return { created: 0, updated: 0, unchanged: 0, skipped: 0 };
    }
}
