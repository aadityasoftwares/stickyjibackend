import { DEFAULT_GLOBAL_ROLE_CODE } from "../../roles/constants/role.constants.js";

export const AUTH_CONSTANTS = {
    ACCESS_TOKEN: {
        EXPIRES_IN: "15m",
        EXPIRES_IN_MS: 15 * 60 * 1000,
    },

    REFRESH_TOKEN: {
        EXPIRES_IN: "30d",
        EXPIRES_IN_MS: 30 * 24 * 60 * 60 * 1000,
    },

    PASSWORD: {
        MIN_LENGTH: 8,
        MAX_LENGTH: 128,
        SALT_ROUNDS: 12,
    },

    LOGIN: {
        MAX_ATTEMPTS: 5,
        LOCK_DURATION_MINUTES: 15,
        LOCK_DURATION_MS: 15 * 60 * 1000,
    },

    EMAIL_VERIFICATION: {
        TOKEN_EXPIRES_IN_MINUTES: 60,
        TOKEN_EXPIRES_IN_MS: 60 * 60 * 1000,
    },

    PASSWORD_RESET: {
        TOKEN_EXPIRES_IN_MINUTES: 30,
        TOKEN_EXPIRES_IN_MS: 30 * 60 * 1000,
    },

    DEFAULT_GLOBAL_ROLE_CODE,
} as const;
