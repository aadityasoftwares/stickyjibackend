import {
    StickyNoteBackgroundPattern,
    StickyNoteColor,
    StickyNoteShape,
    StickyNoteVariant,
    StickyNoteView,
    UserPreferenceCategory,
    UserPreferenceValueType,
    WorkspaceAccessFilter,
} from "./userPreference.enums.js";

export const USER_PREFERENCE_KEYS = {
    // --- Appearance ---
    THEME: "theme",
    SIDEBAR_COLLAPSED: "sidebarCollapsed",

    // --- Localization ---
    TIMEZONE: "timezone",
    LOCALE: "locale",
    LANGUAGE: "language",
    DATE_FORMAT: "dateFormat",
    TIME_FORMAT: "timeFormat",
    WEEK_STARTS_ON: "weekStartsOn",
    PREFERRED_CURRENCY: "preferredCurrency",

    // --- Workspace ---
    SELECTED_WORKSPACE_ID: "selectedWorkspaceId",
    SELECTED_FOLDER_ID: "selectedFolderId",
    WORKSPACE_STATUS_FILTER: "workspaceStatusFilter",
    WORKSPACE_ACCESS_FILTER: "workspaceAccessFilter",
    WORKSPACE_SORT_ORDER: "workspaceSortOrder",
    WORKSPACE_VIEW: "workspaceView",
    WORKSPACE_FOLDER_STATUS_FILTER: "workspaceFolderStatusFilter",
    WORKSPACE_FOLDER_SORT_ORDER: "workspaceFolderSortOrder",
    WORKSPACE_FOLDER_VIEW: "workspaceFolderView",
    WORKSPACE_MEMBER_STATUS_FILTER: "workspaceMemberStatusFilter",
    WORKSPACE_MEMBER_SORT_ORDER: "workspaceMemberSortOrder",
    WORKSPACE_MEMBER_VIEW: "workspaceMemberView",
    WORKSPACE_ROLE_STATUS_FILTER: "workspaceRoleStatusFilter",
    WORKSPACE_ROLE_SORT_ORDER: "workspaceRoleSortOrder",
    WORKSPACE_ROLE_VIEW: "workspaceRoleView",

    // --- Notes ---
    DEFAULT_NOTE_COLOR: "defaultNoteColor",
    DEFAULT_NOTE_SHAPE: "defaultNoteShape",
    DEFAULT_NOTE_VARIANT: "defaultNoteVariant",
    DEFAULT_NOTE_BACKGROUND_PATTERN: "defaultNoteBackgroundPattern",
    STICKY_NOTE_VIEW: "stickyNoteView",
    TODAY_VIEW: "todayView",
    OVERDUE_VIEW: "overdueView",
    FAVOURITE_STATUS_FILTER: "favouriteStatusFilter",
    FAVOURITE_SORT_ORDER: "favouriteSortOrder",
    FAVOURITE_VIEW: "favouriteView",
    FAVORITE_STATUS_FILTER: "favouriteStatusFilter",
    FAVORITE_SORT_ORDER: "favouriteSortOrder",
    FAVORITE_VIEW: "favouriteView",
    STICKY_NOTE_LAYOUT: "stickyNoteLayout",
    STICKY_NOTE_FONT: "stickyNoteFont",
    STICKY_NOTE_FONT_SIZE: "stickyNoteFontSize",

    // --- Editor ---
    AUTOSAVE_ENABLED: "autosaveEnabled",
    AUTOSAVE_INTERVAL: "autosaveInterval",

    // --- Notifications ---
    EMAIL_NOTIFICATIONS: "emailNotifications",
    PUSH_NOTIFICATIONS: "pushNotifications",
    IN_APP_NOTIFICATIONS: "inAppNotifications",
    MARKETING_EMAILS: "marketingEmails",

    // --- Privacy ---
    PROFILE_VISIBLE: "profileVisible",
    SHOW_ONLINE_STATUS: "showOnlineStatus",

    // --- Accessibility ---
    REDUCE_MOTION: "reduceMotion",
    HIGH_CONTRAST: "highContrast",
} as const;

export const USER_PREFERENCE_DEFINITIONS = {
    // --- Appearance ---
    [USER_PREFERENCE_KEYS.THEME]: {
        category: UserPreferenceCategory.APPEARANCE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "system",
    },
    [USER_PREFERENCE_KEYS.SIDEBAR_COLLAPSED]: {
        category: UserPreferenceCategory.APPEARANCE,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: false,
    },

    // --- Localization ---
    [USER_PREFERENCE_KEYS.TIMEZONE]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "UTC",
    },

    [USER_PREFERENCE_KEYS.LOCALE]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "en-US",
    },

    [USER_PREFERENCE_KEYS.LANGUAGE]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "en",
    },

    [USER_PREFERENCE_KEYS.DATE_FORMAT]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "DD/MM/YYYY",
    },

    [USER_PREFERENCE_KEYS.TIME_FORMAT]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "12h",
    },

    [USER_PREFERENCE_KEYS.WEEK_STARTS_ON]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "monday",
    },

    [USER_PREFERENCE_KEYS.PREFERRED_CURRENCY]: {
        category: UserPreferenceCategory.LOCALIZATION,
        type: UserPreferenceValueType.STRING,
        defaultValue: "USD",
    },

    // --- Workspace ---
    [USER_PREFERENCE_KEYS.SELECTED_WORKSPACE_ID]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "",
    },

    [USER_PREFERENCE_KEYS.SELECTED_FOLDER_ID]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "ALL",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: WorkspaceAccessFilter.ALL,
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_SORT_ORDER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "RECENTLY_UPDATED",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_VIEW]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "GRID",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "ALL",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "FOLDER_ORDER",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "GRID",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "ALL",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "RECENTLY_UPDATED",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "LIST",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "ALL",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "PRIORITY",
    },

    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW]: {
        category: UserPreferenceCategory.WORKSPACE,
        type: UserPreferenceValueType.STRING,
        defaultValue: "GRID",
    },

    // --- Notes ---
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteColor.YELLOW,
    },
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteShape.SQUARE,
    },
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteVariant.PLAIN,
    },
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteBackgroundPattern.NONE,
    },
    [USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteView.KANBAN,
    },
    [USER_PREFERENCE_KEYS.TODAY_VIEW]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: StickyNoteView.KANBAN,
    },
    [USER_PREFERENCE_KEYS.OVERDUE_VIEW]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "BAR",
    },
    [USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "ALL",
    },
    [USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "TITLE_ASC",
    },
    [USER_PREFERENCE_KEYS.FAVOURITE_VIEW]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "GRID",
    },
    [USER_PREFERENCE_KEYS.STICKY_NOTE_LAYOUT]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "COMPACT",
    },
    [USER_PREFERENCE_KEYS.STICKY_NOTE_FONT]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.STRING,
        defaultValue: "DM_SANS",
    },
    [USER_PREFERENCE_KEYS.STICKY_NOTE_FONT_SIZE]: {
        category: UserPreferenceCategory.NOTES,
        type: UserPreferenceValueType.NUMBER,
        defaultValue: 14,
    },

    // --- Editor ---
    [USER_PREFERENCE_KEYS.AUTOSAVE_ENABLED]: {
        category: UserPreferenceCategory.EDITOR,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },
    [USER_PREFERENCE_KEYS.AUTOSAVE_INTERVAL]: {
        category: UserPreferenceCategory.EDITOR,
        type: UserPreferenceValueType.NUMBER,
        defaultValue: 5,
    },

    // --- Notifications ---
    [USER_PREFERENCE_KEYS.EMAIL_NOTIFICATIONS]: {
        category: UserPreferenceCategory.NOTIFICATIONS,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },
    [USER_PREFERENCE_KEYS.PUSH_NOTIFICATIONS]: {
        category: UserPreferenceCategory.NOTIFICATIONS,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },
    [USER_PREFERENCE_KEYS.IN_APP_NOTIFICATIONS]: {
        category: UserPreferenceCategory.NOTIFICATIONS,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },
    [USER_PREFERENCE_KEYS.MARKETING_EMAILS]: {
        category: UserPreferenceCategory.NOTIFICATIONS,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: false,
    },

    // --- Privacy ---
    [USER_PREFERENCE_KEYS.PROFILE_VISIBLE]: {
        category: UserPreferenceCategory.PRIVACY,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },
    [USER_PREFERENCE_KEYS.SHOW_ONLINE_STATUS]: {
        category: UserPreferenceCategory.PRIVACY,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: true,
    },

    // --- Accessibility ---
    [USER_PREFERENCE_KEYS.REDUCE_MOTION]: {
        category: UserPreferenceCategory.ACCESSIBILITY,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: false,
    },
    [USER_PREFERENCE_KEYS.HIGH_CONTRAST]: {
        category: UserPreferenceCategory.ACCESSIBILITY,
        type: UserPreferenceValueType.BOOLEAN,
        defaultValue: false,
    },
} as const;

/**
 * Allowed values for string preferences that have a fixed set of options.
 * Normalization is applied before validation (see UserPreferenceValidation.normalizeValue).
 */
export const USER_PREFERENCE_ALLOWED_VALUES: Partial<
    Record<keyof typeof USER_PREFERENCE_DEFINITIONS, readonly string[]>
> = {
    [USER_PREFERENCE_KEYS.THEME]: ["light", "dark", "system"],
    [USER_PREFERENCE_KEYS.DATE_FORMAT]: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
    [USER_PREFERENCE_KEYS.TIME_FORMAT]: ["12h", "24h"],
    [USER_PREFERENCE_KEYS.WEEK_STARTS_ON]: ["monday", "sunday"],
    [USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER]: ["ALL", "ACTIVE", "ARCHIVED", "TRASHED"],
    [USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER]: [
        WorkspaceAccessFilter.ALL,
        WorkspaceAccessFilter.OWNED,
        WorkspaceAccessFilter.SHARED,
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_SORT_ORDER]: [
        "RECENTLY_UPDATED",
        "RECENTLY_CREATED",
        "NAME_ASC",
        "NAME_DESC",
        "OLDEST_FIRST",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_VIEW]: ["GRID", "LIST"],
    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_STATUS_FILTER]: [
        "ALL",
        "ACTIVE",
        "INACTIVE",
        "ARCHIVED",
        "TRASHED",
        "DELETED",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_SORT_ORDER]: [
        "FOLDER_ORDER",
        "POSITION",
        "RECENTLY_UPDATED",
        "RECENTLY_CREATED",
        "NAME_ASC",
        "NAME_DESC",
        "OLDEST_FIRST",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_FOLDER_VIEW]: ["GRID", "LIST"],
    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_STATUS_FILTER]: [
        "ALL",
        "ACTIVE",
        "INVITED",
        "INVITATIONS",
        "REMOVED",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_SORT_ORDER]: [
        "RECENTLY_UPDATED",
        "RECENTLY_CREATED",
        "NAME_ASC",
        "NAME_DESC",
        "OLDEST_FIRST",
        "ROLE",
        "ROLE_ASC",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_MEMBER_VIEW]: ["GRID", "LIST"],
    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_STATUS_FILTER]: ["ALL", "SYSTEM", "CUSTOM", "INACTIVE"],
    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_SORT_ORDER]: [
        "PRIORITY",
        "ROLE_LEVEL",
        "RECENTLY_UPDATED",
        "UPDATED_AT",
        "NAME_ASC",
        "NAME",
        "RECENTLY_CREATED",
        "CREATED_AT",
        "NAME_DESC",
        "OLDEST_FIRST",
    ],
    [USER_PREFERENCE_KEYS.WORKSPACE_ROLE_VIEW]: ["GRID", "LIST"],
    [USER_PREFERENCE_KEYS.STICKY_NOTE_VIEW]: [
        StickyNoteView.NOTES,
        StickyNoteView.KANBAN,
        StickyNoteView.TABLE,
        StickyNoteView.GRID,
    ],
    [USER_PREFERENCE_KEYS.TODAY_VIEW]: [
        StickyNoteView.NOTES,
        StickyNoteView.KANBAN,
        StickyNoteView.TABLE,
        StickyNoteView.GRID,
    ],
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_COLOR]: Object.values(StickyNoteColor),
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_SHAPE]: Object.values(StickyNoteShape),
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_VARIANT]: Object.values(StickyNoteVariant),
    [USER_PREFERENCE_KEYS.DEFAULT_NOTE_BACKGROUND_PATTERN]: Object.values(StickyNoteBackgroundPattern),
    [USER_PREFERENCE_KEYS.OVERDUE_VIEW]: ["BAR", "BUTTON"],
    [USER_PREFERENCE_KEYS.FAVOURITE_STATUS_FILTER]: [
        "ALL",
        "ACTIVE",
        "ARCHIVED",
        "TRASHED",
        "DELETED",
    ],
    [USER_PREFERENCE_KEYS.FAVOURITE_SORT_ORDER]: [
        "TITLE_ASC",
        "TITLE_DESC",
        "TITLE_A_Z",
        "TITLE_Z_A",
        "NAME_ASC",
        "NAME_DESC",
        "RECENTLY_UPDATED",
        "UPDATED_AT",
        "RECENTLY_CREATED",
        "CREATED_AT",
        "OLDEST_FIRST",
    ],
    [USER_PREFERENCE_KEYS.FAVOURITE_VIEW]: ["GRID", "LIST", "KANBAN", "TABLE", "NOTES"],
};
