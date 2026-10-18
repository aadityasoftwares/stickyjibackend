export const SUBSCRIPTION_SEED_CONSTANTS = {
    PREFIX: "[SubscriptionSeeder]",
    LEGACY_DISABLED:
        "Legacy subscription seeding is disabled. Use npm run seed:subscriptions -- --dry-run, then --apply.",
    CONFIG_INVALID: "The default subscription seed configuration is invalid.",
    DATABASE_REQUIRED: "MONGO_URI is required; no database fallback is used.",
    CONNECTION_FAILED:
        "Database connection or seed operation failed. Check connectivity, permissions and server logs; credentials are not printed.",
    CONCURRENT_CHANGE:
        "Configuration changed during seeding. No existing price was overwritten. Inspect and rerun dry-run.",
    INDEX_REPAIR:
        "Required unique index is missing on a populated collection. Review duplicates and use --apply --ensure-indexes, or install the index through a reviewed migration.",
    PRICE_CONFLICT:
        "Historical prices cannot be changed or versioned by this schema. Preserve the price and review a separate price-versioning migration.",
    COLLECTIONS: ["plans", "features", "planFeatures", "planPrices", "currencies"],
} as const;
