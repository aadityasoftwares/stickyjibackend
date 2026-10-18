import { WorkspaceMemberStatus } from "./workspaceMember.enums.js";

export const WORKSPACE_MEMBER_CONSTANTS = {
    STATUS: {
        DEFAULT: WorkspaceMemberStatus.ACTIVE,
    },
    PAGINATION: {
        DEFAULT_PAGE: 1,
        DEFAULT_LIMIT: 20,
        MAX_LIMIT: 100,
    },
    SEARCH: {
        MAX_LENGTH: 100,
    },
    SORT_FIELDS: ["createdAt", "updatedAt", "joinedAt", "status"] as const,
    DEFAULT_SORT_BY: "updatedAt" as const,
    DEFAULT_SORT_ORDER: "desc" as const,
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;