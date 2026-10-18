export const STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS = {
    TITLE: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 500,
    },

    SEARCH: {
        MAX_LENGTH: 100,
    },

    POSITION: {
        MIN: 0,
        DEFAULT: 0,
    },

    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 50,
        MAX_LIMIT: 100,
    },

    DEFAULT_IS_COMPLETED: false,
    DEFAULT_STATUS: "ACTIVE",

    MAX_ITEMS_PER_CHECKLIST: 500,

    SORT_FIELDS: ["position", "title", "createdAt", "updatedAt", "completedAt"],
} as const;
