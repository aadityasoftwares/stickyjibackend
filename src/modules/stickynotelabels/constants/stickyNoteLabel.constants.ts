export const STICKY_NOTE_LABEL_CONSTANTS = {
    NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 50,
    },

    SLUG: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 60,
    },

    COLOR: {
        MAX_LENGTH: 30,
    },

    POSITION: {
        MIN: 0,
        DEFAULT: 0,
    },

    DEFAULT_COLOR: "BLUE",

    DEFAULT_POSITION: 0,

    DEFAULT_STATUS: "ACTIVE",
} as const;