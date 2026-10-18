export const STICKY_NOTE_FAVORITE_CONSTANTS = {
    DEFAULT_STATUS: "ACTIVE",

    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 10,
        MAX_LIMIT: 100,
    },

    SORT: {
        DEFAULT_BY: "createdAt",
        DEFAULT_ORDER: "desc",
    },
} as const;
