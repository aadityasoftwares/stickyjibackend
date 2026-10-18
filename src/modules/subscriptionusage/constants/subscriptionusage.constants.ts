export const SUBSCRIPTION_USAGE_CONSTANTS = {
    COLLECTION_NAME: "subscriptionusages",
    DEFAULT_USERS_COUNT: 1,
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 100,
    DEFAULT_SORT_BY: "updatedAt",
    DEFAULT_SORT_ORDER: "desc",
    RECONCILIATION_BATCH_DEFAULT: 50,
    RECONCILIATION_BATCH_MAX: 500,
    ALLOWED_SORT_FIELDS: [
        "workspacesUsed",
        "activeStickyNotesUsed",
        "storageBytesUsed",
        "updatedAt",
        "createdAt",
    ] as const,
} as const;
