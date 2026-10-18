export const USER_PROFILE_CONSTANTS = {
    FIRST_NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 100,
    },
    LAST_NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 100,
    },
    DISPLAY_NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 150,
    },
    BIO: {
        MAX_LENGTH: 500,
    },
    OCCUPATION: {
        MAX_LENGTH: 150,
    },
    EDUCATION: {
        MAX_LENGTH: 200,
    },
    INTERESTS: {
        MAX_ITEMS: 20,
        MAX_ITEM_LENGTH: 100,
    },
} as const;
