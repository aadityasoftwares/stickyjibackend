export enum WorkspaceStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    ARCHIVED = "ARCHIVED",
    TRASHED = "TRASHED",
    DELETED = "DELETED",
}

// DELETED remains readable for workspaces trashed before retention was introduced.
export const WORKSPACE_TRASH_STATUSES = [WorkspaceStatus.TRASHED, WorkspaceStatus.DELETED];
export const isWorkspaceTrashed = (status: unknown): boolean =>
    WORKSPACE_TRASH_STATUSES.includes(status as WorkspaceStatus);

export enum WorkspaceVisibility {
    PRIVATE = "PRIVATE",
    INVITE_ONLY = "INVITE_ONLY",
    PUBLIC = "PUBLIC",
}

export enum WorkspaceAccessFilter {
    ALL = "ALL",
    OWNED = "OWNED",
    SHARED = "SHARED",
}

export enum WorkspaceType {
    PERSONAL = "PERSONAL",
    TEAM = "TEAM",
}
