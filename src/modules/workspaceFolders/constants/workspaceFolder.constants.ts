import { WorkspaceFolderStatus } from "./workspaceFolder.enums.js";

export const WORKSPACE_FOLDER_CONSTANTS = {
    TRASH: { RETENTION_DAYS: 60 },
    NAME: { MIN_LENGTH: 1, MAX_LENGTH: 100 },
    SLUG: { MIN_LENGTH: 1, MAX_LENGTH: 120 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    ICON: { MAX_LENGTH: 100 },
    COLOR: { MAX_LENGTH: 20 },
    POSITION: { MIN: 0, DEFAULT: 0 },
    PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 100 },
    SEARCH: { MAX_LENGTH: 100 },
    SORT_FIELDS: ["position", "name", "slug", "createdAt", "updatedAt"],
    DEFAULT_SORT_BY: "position",
    DEFAULT_SORT_ORDER: "asc" as const,
    DEFAULT_STATUS: WorkspaceFolderStatus.ACTIVE,
    DEFAULT_IS_DEFAULT: false,
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MAX_SEARCH_LENGTH: 100,
} as const;
