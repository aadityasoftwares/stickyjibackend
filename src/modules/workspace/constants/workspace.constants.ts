import { WorkspaceAccessFilter, WorkspaceStatus, WorkspaceType, WorkspaceVisibility } from "./workspace.enums.js";

export const WORKSPACE_ACCESS_FILTER_LABELS = {
    [WorkspaceAccessFilter.ALL]: "All spaces",
    [WorkspaceAccessFilter.OWNED]: "My spaces",
    [WorkspaceAccessFilter.SHARED]: "Shared with me",
} as const;

export const WORKSPACE_STATUS_FILTER_LABELS = {
    ALL: "All statuses",
    [WorkspaceStatus.ACTIVE]: "Active",
    [WorkspaceStatus.ARCHIVED]: "Archived",
    [WorkspaceStatus.TRASHED]: "Trash",
} as const;

export const WORKSPACE_TYPE_LABELS = { [WorkspaceType.PERSONAL]: "Personal", [WorkspaceType.TEAM]: "Team" } as const;
export const WORKSPACE_ACCESS_LABELS = { OWNER: "Owner", MEMBER: "Member" } as const;

export const WORKSPACE_CONSTANTS = {
    TRASH: { RETENTION_DAYS: 60, PURGE_BATCH_SIZE: 100 },
    NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
    SLUG: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 100 },
    SEARCH: { MAX_LENGTH: 100 },
    SORT_FIELDS: ["name", "slug", "createdAt", "updatedAt"],
    DEFAULT_SORT_BY: "createdAt",
    DEFAULT_SORT_ORDER: "desc" as const,
    DEFAULT_VISIBILITY: WorkspaceVisibility.PRIVATE,
    DEFAULT_PERSONAL_WORKSPACE: false,
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MAX_SEARCH_LENGTH: 100,
} as const;
