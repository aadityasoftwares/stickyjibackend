import mongoose, { type ClientSession } from "mongoose";
import { PlanModel } from "../../../modules/plan/models/plan.model.js";
import { FeatureModel } from "../../../modules/feature/models/feature.model.js";
import { PlanFeatureModel } from "../../../modules/planfeature/models/planfeature.model.js";
import { PlanPriceModel } from "../../../modules/planprice/models/planPrice.model.js";
import { CurrencyModel } from "../../../modules/currency/models/currency.model.js";
import { UserSubscriptionModel } from "../../../modules/usersubscription/models/usersubscription.model.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { SUBSCRIPTION_SEED_CONSTANTS } from "../constants/subscription-seed.constants.js";
import type { SeedCollection, SeedDocument, SeedOperation, SeedSnapshot } from "../interfaces/subscription-seed.interface.js";

const COLLECTION_NAMES: Record<SeedCollection, string> = {
    plans: PlanModel.collection.name,
    features: FeatureModel.collection.name,
    planFeatures: PlanFeatureModel.collection.name,
    planPrices: PlanPriceModel.collection.name,
    currencies: CurrencyModel.collection.name,
};

export const SUBSCRIPTION_REQUIRED_INDEXES: Array<{
    collection: SeedCollection;
    name: string;
    key: Record<string, 1>;
    partialFilterExpression?: Record<string, unknown>;
}> = [
    { collection: "plans", name: "code_1", key: { code: 1 } },
    { collection: "plans", name: "uniq_default_plan", key: { isDefault: 1 }, partialFilterExpression: { isDefault: true } },
    { collection: "features", name: "code_1", key: { code: 1 } },
    { collection: "planFeatures", name: "planId_1_featureId_1", key: { planId: 1, featureId: 1 } },
    { collection: "planPrices", name: "planId_1_currencyId_1_billingInterval_1", key: { planId: 1, currencyId: 1, billingInterval: 1 } },
    { collection: "currencies", name: "code_1", key: { code: 1 } },
    { collection: "currencies", name: "numericCode_1", key: { numericCode: 1 } },
];

export class SubscriptionSeedRepository {
    private collection(key: SeedCollection) {
        const database = mongoose.connection.db;
        if (!database) throw new AppError(SUBSCRIPTION_SEED_CONSTANTS.CONNECTION_FAILED, 503);
        return database.collection(COLLECTION_NAMES[key]);
    }

    async snapshot(session?: ClientSession): Promise<SeedSnapshot> {
        if (session) {
            // Operations on a transaction's session must execute sequentially.
            const snapshot = {} as SeedSnapshot;
            for (const key of SUBSCRIPTION_SEED_CONSTANTS.COLLECTIONS) {
                snapshot[key] = await this.collection(key).find({}, { session }).toArray() as SeedDocument[];
            }
            return snapshot;
        }
        const entries = await Promise.all(SUBSCRIPTION_SEED_CONSTANTS.COLLECTIONS.map(async key => [
            key, await this.collection(key).find({}, { session }).toArray(),
        ] as const));
        return Object.fromEntries(entries) as SeedSnapshot;
    }

    async missingIndexes() {
        const indexLists = new Map<SeedCollection, Array<{
            key: Record<string, unknown>;
            unique?: boolean;
            sparse?: boolean;
            partialFilterExpression?: Record<string, unknown>;
        }>>();
        for (const key of SUBSCRIPTION_SEED_CONSTANTS.COLLECTIONS) {
            try {
                indexLists.set(key, await this.collection(key).indexes());
            } catch (error) {
                if (typeof error === "object" && error && "code" in error && error.code === 26) {
                    indexLists.set(key, []);
                } else {
                    throw error;
                }
            }
        }
        return SUBSCRIPTION_REQUIRED_INDEXES.filter(required => !indexLists.get(required.collection)?.some(index =>
            index.unique === true && !index.sparse &&
            JSON.stringify(index.key) === JSON.stringify(required.key) &&
            JSON.stringify(index.partialFilterExpression) === JSON.stringify(required.partialFilterExpression),
        ));
    }

    async createMissingIndexes(indexes: typeof SUBSCRIPTION_REQUIRED_INDEXES): Promise<void> {
        for (const index of indexes) {
            await this.collection(index.collection).createIndex(index.key, {
                name: index.name,
                unique: true,
                ...(index.partialFilterExpression ? { partialFilterExpression: index.partialFilterExpression } : {}),
            });
        }
    }

    async countReferencedSubscriptions(plans: SeedDocument[]): Promise<number> {
        const ids = plans.map(plan => plan._id);
        return UserSubscriptionModel.countDocuments({ plan: { $in: ids } }).exec();
    }

    async supportsTransactions(): Promise<boolean> {
        const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
        return Boolean((hello.setName || hello.msg === "isdbgrid") && hello.logicalSessionTimeoutMinutes != null);
    }

    async execute(operations: SeedOperation[], session?: ClientSession): Promise<void> {
        // Referenced documents are written before relationships; a concurrent insert aborts
        // this pass before dependent writes can use an outdated proposed ObjectId.
        for (const key of ["plans", "features", "currencies", "planFeatures", "planPrices"] as const) {
            const stage = operations.filter(operation => operation.collection === key);
            if (key === "plans") {
                stage.sort((left, right) => Number(left.values.isDefault !== false) - Number(right.values.isDefault !== false));
            }
            if (!stage.length) continue;
            const now = new Date();
            const result = await this.collection(key).bulkWrite(stage.map(operation => ({
                updateOne: operation.action === "create" ? {
                    filter: operation.filter,
                    update: { $setOnInsert: { ...operation.values, createdAt: now, updatedAt: now } },
                    upsert: true,
                } : {
                    filter: operation.filter,
                    update: { $set: { ...operation.values, updatedAt: now } },
                    upsert: false,
                },
            })), { ordered: true, session });
            const creates = stage.filter(operation => operation.action === "create").length;
            const updates = stage.length - creates;
            if (result.upsertedCount !== creates || result.matchedCount !== updates) {
                throw new AppError(SUBSCRIPTION_SEED_CONSTANTS.CONCURRENT_CHANGE, 409);
            }
        }
    }

    async transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
        const session = await mongoose.startSession();
        try {
            return await session.withTransaction(() => work(session));
        } finally {
            await session.endSession();
        }
    }
}
