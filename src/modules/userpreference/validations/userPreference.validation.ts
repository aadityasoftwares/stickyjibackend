import {
    USER_PREFERENCE_ALLOWED_VALUES,
    USER_PREFERENCE_DEFINITIONS,
    USER_PREFERENCE_KEYS,
} from "../constants/userPreference.constants.js";
import { UserPreferenceValueType } from "../constants/userPreference.enums.js";
import type { UserPreferenceValue } from "../interfaces/userPreference.interface.js";

const preferenceKeys = Object.keys(USER_PREFERENCE_DEFINITIONS);

// Build a case-insensitive lookup map: lowercase key -> canonical key
const preferenceKeyMap = new Map(preferenceKeys.map((key) => [key.toLowerCase(), key]));
preferenceKeyMap.set("folderstatusfilter", USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER);
preferenceKeyMap.set("foldersortorder", USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER);
preferenceKeyMap.set("folderview", USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW);
preferenceKeyMap.set("memberstatusfilter", USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER);
preferenceKeyMap.set("membersortorder", USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER);
preferenceKeyMap.set("memberview", USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW);
preferenceKeyMap.set("rolestatusfilter", USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER);
preferenceKeyMap.set("rolesortorder", USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER);
preferenceKeyMap.set("roleview", USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW);
preferenceKeyMap.set("todayview", USER_PREFERENCE_KEYS.TODAY_VIEW);
preferenceKeyMap.set("today_view", USER_PREFERENCE_KEYS.TODAY_VIEW);
preferenceKeyMap.set("todaystickynoteview", USER_PREFERENCE_KEYS.TODAY_VIEW);
preferenceKeyMap.set("todaynoteview", USER_PREFERENCE_KEYS.TODAY_VIEW);
preferenceKeyMap.set("stickynoteview", USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW);
preferenceKeyMap.set("overdueview", USER_PREFERENCE_KEYS.OVERDUE_VIEW);
preferenceKeyMap.set("overdue_view", USER_PREFERENCE_KEYS.OVERDUE_VIEW);
preferenceKeyMap.set("todayoverdueview", USER_PREFERENCE_KEYS.OVERDUE_VIEW);

export const UserPreferenceValidation = {
    keys: preferenceKeys,

    isValidKey(value: unknown): boolean {
        return typeof value === "string" && preferenceKeyMap.has(value.trim().toLowerCase());
    },

    /**
     * Returns the canonical key (as defined in USER_PREFERENCE_KEYS) or null.
     * Keys are case-insensitive on input; canonical form preserves original casing.
     */
    getCanonicalKey(value: string): string | null {
        return preferenceKeyMap.get(value.trim().toLowerCase()) ?? null;
    },

    /**
     * Returns the storage key (lowercased).
     * The model schema also applies `lowercase: true`, so this must stay consistent.
     */
    getStorageKey(value: string): string {
        return value.trim().toLowerCase();
    },

    getDefinition(key: string) {
        const canonicalKey = this.getCanonicalKey(key);

        if (!canonicalKey) {
            return undefined;
        }

        return USER_PREFERENCE_DEFINITIONS[canonicalKey as keyof typeof USER_PREFERENCE_DEFINITIONS];
    },

    isBoolean(value: unknown): value is boolean {
        return typeof value === "boolean";
    },

    isNumber(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value);
    },

    isString(value: unknown): value is string {
        return typeof value === "string";
    },

    isJson(value: unknown): boolean {
        return value !== null && typeof value === "object";
    },

    isValidValue(value: unknown, valueType: UserPreferenceValueType): boolean {
        switch (valueType) {
            case UserPreferenceValueType.STRING:
                return this.isString(value);
            case UserPreferenceValueType.NUMBER:
                return this.isNumber(value);
            case UserPreferenceValueType.BOOLEAN:
                return this.isBoolean(value);
            case UserPreferenceValueType.JSON:
                return this.isJson(value);
            default:
                return false;
        }
    },

    /**
     * Normalizes a preference value before storage.
     * Normalization rules are key-specific (e.g. currency -> uppercase, language -> lowercase).
     * Returns the original value unchanged if no normalization applies.
     *
     * IMPORTANT: timezone preserves case (e.g. "Asia/Kolkata" must not become "asia/kolkata").
     */
    normalizeValue(canonicalKey: string, value: UserPreferenceValue): UserPreferenceValue {
        if (typeof value !== "string") {
            return value;
        }

        switch (canonicalKey) {
            case USER_PREFERENCE_KEYS.PREFERRED_CURRENCY:
                // ISO 4217: 3-letter uppercase code
                return value.toUpperCase();

            case USER_PREFERENCE_KEYS.LANGUAGE:
                // BCP-47 language subtag: lowercase
                return value.toLowerCase();

            case USER_PREFERENCE_KEYS.THEME:
            case USER_PREFERENCE_KEYS.WEEK_STARTS_ON:
            case USER_PREFERENCE_KEYS.TIME_FORMAT:
                // Normalize to lowercase
                return value.toLowerCase();

            case USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER:
            case USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER:
            case USER_PREFERENCE_KEYS.WORKSPACE_SORT_ORDER:
            case USER_PREFERENCE_KEYS.WORKSPACE_VIEW:
            case USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER:
            case USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER:
            case USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW:
            case USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER:
            case USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER:
            case USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW:
            case USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER:
            case USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER:
            case USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW:
            case USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW:
            case USER_PREFERENCE_KEYS.TODAY_VIEW:
            case USER_PREFERENCE_KEYS.OVERDUE_VIEW:
                // Normalize screen-specific preferences to uppercase
                return value.trim().toUpperCase();

            case USER_PREFERENCE_KEYS.TIMEZONE:
                // Preserve IANA timezone casing (e.g. "Asia/Kolkata")
                return value.trim();

            case USER_PREFERENCE_KEYS.LOCALE:
                // Preserve locale casing (e.g. "en-US", "hi-IN")
                return value.trim();

            case USER_PREFERENCE_KEYS.DATE_FORMAT:
                // Preserve exact format casing
                return value.trim();

            default:
                return value;
        }
    },

    /**
     * Validates the domain of a preference value after normalization.
     * Returns null if valid, or an error message string if invalid.
     *
     * Only keys with fixed allowed sets or specific format rules are validated here.
     * General type validation (string/number/boolean) is handled by isValidValue.
     */
    validateDomainValue(canonicalKey: string, value: UserPreferenceValue): string | null {
        if (typeof value !== "string") {
            // Domain validation only applies to string preferences in this module.
            return null;
        }

        // Fixed allowed-values keys
        const allowedValues =
            USER_PREFERENCE_ALLOWED_VALUES[canonicalKey as keyof typeof USER_PREFERENCE_ALLOWED_VALUES];

        if (allowedValues) {
            if (!allowedValues.includes(value)) {
                return `Invalid value for "${canonicalKey}". Allowed: ${allowedValues.join(", ")}.`;
            }
            return null;
        }

        // Key-specific format validation
        switch (canonicalKey) {
            case USER_PREFERENCE_KEYS.TIMEZONE:
                return this._validateTimezone(value);

            case USER_PREFERENCE_KEYS.LOCALE:
                return this._validateLocale(value);

            case USER_PREFERENCE_KEYS.LANGUAGE:
                return this._validateLanguage(value);

            case USER_PREFERENCE_KEYS.PREFERRED_CURRENCY:
                return this._validateCurrency(value);

            default:
                return null;
        }
    },

    /**
     * Validates IANA timezone using the native Intl API.
     * No external library required.
     */
    _validateTimezone(value: string): string | null {
        if (!value.trim()) {
            return "Timezone must not be empty.";
        }

        try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return null;
        } catch {
            return `Invalid timezone: "${value}". Use a valid IANA timezone (e.g. Asia/Kolkata, UTC, America/New_York).`;
        }
    },

    /**
     * Validates locale using the native Intl API.
     * Accepts values like "en-US", "hi-IN", "fr-FR".
     */
    _validateLocale(value: string): string | null {
        if (!value.trim()) {
            return "Locale must not be empty.";
        }

        // Basic structural check: letters, optional hyphen+letters/digits
        const localeRegex = /^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/;
        if (!localeRegex.test(value.trim())) {
            return `Invalid locale: "${value}". Expected format like en-US, hi-IN, fr-FR.`;
        }

        return null;
    },

    /**
     * Validates language code (BCP-47 primary subtag, e.g. "en", "hi", "fr").
     */
    _validateLanguage(value: string): string | null {
        if (!value.trim()) {
            return "Language must not be empty.";
        }

        // Basic language subtag: 2-8 lowercase alpha chars
        const langRegex = /^[a-z]{2,8}$/;
        if (!langRegex.test(value)) {
            return `Invalid language: "${value}". Expected a 2-8 letter code like en, hi, fr.`;
        }

        return null;
    },

    /**
     * Validates ISO 4217 currency code: exactly 3 uppercase letters.
     * Value is expected to already be uppercased via normalizeValue.
     */
    _validateCurrency(value: string): string | null {
        if (!/^[A-Z]{3}$/.test(value)) {
            return `Invalid currency: "${value}". Expected a 3-letter ISO 4217 code like USD, INR, EUR.`;
        }

        return null;
    },
};
