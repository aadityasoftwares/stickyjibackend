import { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";

export const WorkspaceMemberValidation = {
    statuses: Object.values(WorkspaceMemberStatus),

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidStatus(value: unknown): value is WorkspaceMemberStatus {
        return typeof value === "string" && this.statuses.includes(value as WorkspaceMemberStatus);
    },

    isActiveStatus(value: unknown): boolean {
        return value === WorkspaceMemberStatus.ACTIVE;
    },

    isInvitedStatus(value: unknown): boolean {
        return value === WorkspaceMemberStatus.INVITED;
    },

    isRemovedStatus(value: unknown): boolean {
        return value === WorkspaceMemberStatus.REMOVED;
    },
};
