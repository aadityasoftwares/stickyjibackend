export const WORKSPACE_MEMBER_INVITATION_CONSTANTS = {
    TOKEN: {
        RAW_BYTES: 32,
        HASH_LENGTH: 64,
    },
    EMAIL: {
        MAX_LENGTH: 254,
    },
    MESSAGE: {
        MAX_LENGTH: 500,
    },
    BATCH: {
        MAX_INVITATIONS: 50,
    },
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100,
    },
    DEFAULT_EXPIRY_DAYS: 7,
} as const;
