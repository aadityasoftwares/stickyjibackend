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
    PROFILE_IMAGE: {
        MAX_SIZE: 5 * 1024 * 1024,
        ALLOWED_MIME_TYPES: ["image/jpeg", "image/png", "image/webp"] as const,
        ALLOWED_EXTENSIONS: ["jpg", "jpeg", "png", "webp"] as const,
    },
} as const;
