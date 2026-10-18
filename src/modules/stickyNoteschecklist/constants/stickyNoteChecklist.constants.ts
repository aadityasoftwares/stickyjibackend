export const STICKY_NOTE_CHECKLIST_CONSTANTS = {
    TITLE: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 200,
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
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
    },

    DEFAULT_STATUS: "ACTIVE",

    MAX_CHECKLISTS_PER_NOTE: 50,

    SORT_FIELDS: [
        "position",
        "title",
        "createdAt",
        "updatedAt",
    ],
} as const;
