import { Types } from "mongoose";

import { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";
import { WORKSPACE_MEMBER_INVITATION_CONSTANTS } from "../constants/workspaceMemberInvitation.constants.js";

export const WorkspaceMemberInvitationValidation = {
    statuses: Object.values(WorkspaceInvitationStatus),

    isValidObjectId(value: unknown): boolean {
        if (value instanceof Types.ObjectId) {
            return true;
        }

        if (typeof value !== "string") {
            return false;
        }

        const objectId = value.trim();

        return /^[a-fA-F0-9]{24}$/.test(objectId) && Types.ObjectId.isValid(objectId);
    },

    isValidStatus(value: unknown): value is WorkspaceInvitationStatus {
        return typeof value === "string" && this.statuses.includes(value as WorkspaceInvitationStatus);
    },

    isValidEmail(value: unknown): boolean {
        if (typeof value !== "string") {
            return false;
        }

        const email = this.normalizeEmail(value);

        if (!email || email.length > WORKSPACE_MEMBER_INVITATION_CONSTANTS.EMAIL.MAX_LENGTH) {
            return false;
        }

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isValidMessage(value: unknown): boolean {
        if (value === undefined || value === null) {
            return true;
        }

        return (
            typeof value === "string" && value.trim().length <= WORKSPACE_MEMBER_INVITATION_CONSTANTS.MESSAGE.MAX_LENGTH
        );
    },

    normalizeEmail(value: string): string {
        return value.trim().toLowerCase();
    },

    normalizeMessage(value: string): string {
        return value.trim();
    },

    isValidDate(value: unknown): boolean {
        if (value instanceof Date) {
            return !Number.isNaN(value.getTime());
        }

        if (typeof value !== "string") {
            return false;
        }

        const date = new Date(value);

        return !Number.isNaN(date.getTime());
    },

    isFutureDate(value: unknown): boolean {
        if (!this.isValidDate(value)) {
            return false;
        }

        const date = value instanceof Date ? value : new Date(value as string);

        return date.getTime() > Date.now();
    },
};
