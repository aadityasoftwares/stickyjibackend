import type { Types } from "mongoose";

export type SeedCollection = "plans" | "features" | "planFeatures" | "planPrices" | "currencies";
export type SeedMode = "dry-run" | "verify" | "apply";
export interface SubscriptionSeedOptions {
    mode: SeedMode;
    syncDefaults?: boolean;
    ensureIndexes?: boolean;
}
export type SeedDocument = Record<string, unknown> & { _id: Types.ObjectId };
export type SeedSnapshot = Record<SeedCollection, SeedDocument[]>;
export interface SeedOperation {
    collection: SeedCollection;
    key: string;
    action: "create" | "update";
    filter: Record<string, unknown>;
    values: Record<string, unknown>;
}
export interface SeedCounts {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
}
export interface SubscriptionSeedReport {
    mode: SeedMode;
    valid: boolean;
    applied: boolean;
    partialWritesPossible: boolean;
    transactions: boolean;
    counts: Record<SeedCollection, SeedCounts>;
    operations: SeedOperation[];
    conflicts: string[];
    errors: string[];
    missingIndexes: string[];
    referencedSubscriptions: number;
    freePricing: string;
}
