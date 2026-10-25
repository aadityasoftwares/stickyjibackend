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

// Sidebar collapsed aliases
preferenceKeyMap.set("sidebarcollapsed", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("sidebar_collapsed", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("sidebarcollapsd", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("sidebar_collapsd", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("issidebarcollapsed", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("is_sidebar_collapsed", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("sidebarcollapse", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("sidebar_collapse", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("collapsesidebar", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);
preferenceKeyMap.set("collapse_sidebar", USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED);

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
preferenceKeyMap.set("sticky_note_view", USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW);
preferenceKeyMap.set("overdueview", USER_PREFERENCE_KEYS.OVERDUE_VIEW);
preferenceKeyMap.set("overdue_view", USER_PREFERENCE_KEYS.OVERDUE_VIEW);
preferenceKeyMap.set("todayoverdueview", USER_PREFERENCE_KEYS.OVERDUE_VIEW);

// Favourite / Favorite screen aliases
preferenceKeyMap.set("favouriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("favourite_view", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("favoriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("favorite_view", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("stickynotefavouriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("stickynotefavoriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("noteslibraryfavouriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);
preferenceKeyMap.set("noteslibraryfavoriteview", USER_PREFERENCE_KEYS.FAVOURITE_VIEW);

preferenceKeyMap.set("favouritestatusfilter", USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
preferenceKeyMap.set("favourite_status_filter", USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
preferenceKeyMap.set("favoritestatusfilter", USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);
preferenceKeyMap.set("favorite_status_filter", USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER);

preferenceKeyMap.set("favouritesortorder", USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);
preferenceKeyMap.set("favourite_sort_order", USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);
preferenceKeyMap.set("favoritesortorder", USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);
preferenceKeyMap.set("favorite_sort_order", USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER);

preferenceKeyMap.set("favouriteselectedworkspace", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favourite_selected_workspace", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favouriteselectedworkspaceid", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favourite_selected_workspace_id", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favoriteselectedworkspace", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favorite_selected_workspace", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favoriteselectedworkspaceid", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);
preferenceKeyMap.set("favorite_selected_workspace_id", USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE);

// My Notes screen aliases
preferenceKeyMap.set("mynotesview", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("mynotes_view", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("my_notes_view", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("mynoteview", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("my_note_view", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("noteslibraryview", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);
preferenceKeyMap.set("noteslibrarynotesview", USER_PREFERENCE_KEYS.MY_NOTES_VIEW);

preferenceKeyMap.set("mynotesstatusfilter", USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER);
preferenceKeyMap.set("mynotes_status_filter", USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER);
preferenceKeyMap.set("my_notes_status_filter", USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER);
preferenceKeyMap.set("mynotestatusfilter", USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER);
preferenceKeyMap.set("my_note_status_filter", USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER);

preferenceKeyMap.set("mynotessortorder", USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER);
preferenceKeyMap.set("mynotes_sort_order", USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER);
preferenceKeyMap.set("my_notes_sort_order", USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER);
preferenceKeyMap.set("mynotesortorder", USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER);
preferenceKeyMap.set("my_note_sort_order", USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER);

preferenceKeyMap.set("mynotesselectedworkspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("mynotes_selected_workspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("my_notes_selected_workspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("mynotesselectedworkspaceid", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("mynotes_selected_workspace_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("my_notes_selected_workspace_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("mynoteselectedworkspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("my_note_selected_workspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("notesselectedworkspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("notes_selected_workspace", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("notesselectedworkspaceid", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);
preferenceKeyMap.set("notes_selected_workspace_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE);

preferenceKeyMap.set("mynotesselectedfolder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("mynotes_selected_folder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("my_notes_selected_folder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("mynotesselectedfolderid", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("mynotes_selected_folder_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("my_notes_selected_folder_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("mynoteselectedfolder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("my_note_selected_folder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("notesselectedfolder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("notes_selected_folder", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("notesselectedfolderid", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);
preferenceKeyMap.set("notes_selected_folder_id", USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER);

// Note selection aliases
preferenceKeyMap.set("defaultnotecolor", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);
preferenceKeyMap.set("default_note_color", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);
preferenceKeyMap.set("notecolor", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);
preferenceKeyMap.set("note_color", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);
preferenceKeyMap.set("stickynotecolor", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);
preferenceKeyMap.set("sticky_note_color", USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR);

preferenceKeyMap.set("defaultnoteshape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("default_note_shape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("noteshape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("note_shape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("stickynoteshape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("sticky_note_shape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);
preferenceKeyMap.set("shape", USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE);

preferenceKeyMap.set("defaultnotevariant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("default_note_variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("notevariant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("note_variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("papervariant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("paper_variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("defaultpapervariant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("default_paper_variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("stickynotevariant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("sticky_note_variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);
preferenceKeyMap.set("variant", USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT);

preferenceKeyMap.set("defaultnotebackgroundpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("default_note_background_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("defaultnotepattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("default_note_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("notebackgroundpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("note_background_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("notepattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("note_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("paperpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("paper_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("defaultpaperpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("default_paper_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("backgroundpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("background_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("stickynotepattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("sticky_note_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("stickynotebackgroundpattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("sticky_note_background_pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);
preferenceKeyMap.set("pattern", USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN);

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
        return typeof value === "boolean" || value === "true" || value === "false";
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
        const def = USER_PREFERENCE_DEFINITIONS[canonicalKey as keyof typeof USER_PREFERENCE_DEFINITIONS];
        if (def?.type === UserPreferenceValueType.BOOLEAN && typeof value === "string") {
            const trimmed = value.trim().toLowerCase();
            if (trimmed === "true") return true;
            if (trimmed === "false") return false;
        }

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

            case USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR:
            case USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE:
            case USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT:
            case USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN:
                // Normalize note selection preferences to uppercase with underscores
                return value.trim().toUpperCase().replace(/[\s-]+/g, "_");

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
            case USER_PREFERENCE_KEYS.FAVOURITE_VIEW:
            case USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER:
            case USER_PREFERENCE_KEYS.MY_NOTES_VIEW:
            case USER_PREFERENCE_KEYS.MY_NOTES_STATUS_FILTER:
                // Normalize screen-specific preferences to uppercase
                return value.trim().toUpperCase();

            case USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER:
            case USER_PREFERENCE_KEYS.MY_NOTES_SORT_ORDER: {
                const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
                if (normalized === "TITLE_A_Z" || normalized === "A_Z") return "TITLE_ASC";
                if (normalized === "TITLE_Z_A" || normalized === "Z_A") return "TITLE_DESC";
                if (normalized === "RECENTLY_UPDATED" || normalized === "UPDATED_AT") return "RECENTLY_UPDATED";
                if (normalized === "RECENTLY_CREATED" || normalized === "CREATED_AT") return "RECENTLY_CREATED";
                return normalized;
            }

            case USER_PREFERENCE_KEYS.TIMEZONE:
            case USER_PREFERENCE_KEYS.FAVOURITE_SELECTED_WORKSPACE:
            case USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_WORKSPACE:
            case USER_PREFERENCE_KEYS.MY_NOTES_SELECTED_FOLDER:
                // Preserve IANA timezone casing or workspace/folder ID
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
