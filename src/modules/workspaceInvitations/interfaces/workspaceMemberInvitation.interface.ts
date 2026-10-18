import type { Document, Types } from "mongoose";

import type { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";

export interface IWorkspaceMemberInvitation {
    workspaceId: Types.ObjectId;
    userId?: Types.ObjectId | null;
    email: string;
    roleId: Types.ObjectId;
    invitedBy: Types.ObjectId;
    tokenHash: string;
    status: WorkspaceInvitationStatus;
    message?: string | null;
    expiresAt: Date;
    acceptedAt?: Date | null;
    rejectedAt?: Date | null;
    cancelledAt?: Date | null;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceMemberInvitationDocument extends IWorkspaceMemberInvitation, Document {
    _id: Types.ObjectId;
}

export interface IWorkspaceMemberInvitationCreateItem {
    email: string;
    roleId: Types.ObjectId | string;
    message?: string | null;
}

/**
 * Preferred payload:
 * {
 *   workspaceId,
 *   invitations: [{ email, roleId, message? }]
 * }
 *
 * Legacy single-invitation fields remain supported so the existing Angular
 * screen does not break while it is migrated to the batch UI.
 */
export interface IWorkspaceMemberInvitationCreate {
    workspaceId: Types.ObjectId | string;
    invitations?: IWorkspaceMemberInvitationCreateItem[];
    email?: string;
    roleId?: Types.ObjectId | string;
    message?: string | null;
}

export interface IWorkspaceMemberInvitationUpdate {
    roleId?: Types.ObjectId | string;
    message?: string | null;
    expiresAt?: Date | string;
}

export interface IWorkspaceMemberInvitationFilter {
    workspaceId?: Types.ObjectId | string;
    userId?: Types.ObjectId | string;
    email?: string;
    roleId?: Types.ObjectId | string;
    invitedBy?: Types.ObjectId | string;
    status?: WorkspaceInvitationStatus;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export type WorkspaceMemberInvitationSkipCode =
    "SELF" | "OWNER" | "EXISTING_MEMBER" | "PENDING_INVITATION" | "ROLE_NOT_FOUND" | "ROLE_NOT_ALLOWED";

export interface IWorkspaceMemberInvitationSkipped {
    email: string;
    code: WorkspaceMemberInvitationSkipCode;
    message: string;
}

export interface IWorkspaceMemberInvitationCreateSummary {
    requested: number;
    created: number;
    skipped: number;
    emailSent: number;
    emailFailed: number;
}

export interface IWorkspaceMemberInvitationCreateResult {
    invitations: Array<
        Omit<IWorkspaceMemberInvitation, "tokenHash"> & {
            _id: Types.ObjectId;
        }
    >;
    skipped: IWorkspaceMemberInvitationSkipped[];
    summary: IWorkspaceMemberInvitationCreateSummary;
}

export interface IWorkspaceMemberInvitationPaginatedResult {
    data: IWorkspaceMemberInvitationDocument[];
    total: number;
}

/**
 * Safe public data returned by POST /validate-token.
 * Never expose tokenHash, internal audit fields, or unrestricted user data.
 */
export interface IWorkspaceMemberInvitationPreview {
    invitationId: string;
    email: string;
    userExists: boolean;
    workspace: {
        id: string;
        name: string;
        slug?: string;
    };
    role: {
        id: string;
        name: string;
        displayName?: string;
        code?: string;
    };
    invitedBy: {
        id?: string;
        name: string;
        email?: string;
    };
    message?: string | null;
    expiresAt: Date;
}

/**
 * Compact authenticated result returned by POST /accept.
 * Matches the Angular WorkspaceInvitationAcceptResult contract.
 */
export interface IWorkspaceMemberInvitationAcceptResult {
    invitationId: string;
    workspaceId: string;
    workspaceName: string;
    memberId: string;
    roleName: string;
    acceptedAt: Date;
}
