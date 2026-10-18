import mongoose, { type Model, Schema } from "mongoose";

import type { IWorkspaceMemberInvitationDocument } from "../interfaces/workspaceMemberInvitation.interface.js";
import { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";
import { WORKSPACE_MEMBER_INVITATION_CONSTANTS } from "../constants/workspaceMemberInvitation.constants.js";

const WorkspaceMemberInvitationSchema = new Schema<IWorkspaceMemberInvitationDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: WORKSPACE_MEMBER_INVITATION_CONSTANTS.EMAIL.MAX_LENGTH,
        },
        roleId: {
            type: Schema.Types.ObjectId,
            ref: "Role",
            required: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false,
            minlength: WORKSPACE_MEMBER_INVITATION_CONSTANTS.TOKEN.HASH_LENGTH,
            maxlength: WORKSPACE_MEMBER_INVITATION_CONSTANTS.TOKEN.HASH_LENGTH,
        },
        status: {
            type: String,
            enum: Object.values(WorkspaceInvitationStatus),
            required: true,
            default: WorkspaceInvitationStatus.PENDING,
        },
        message: {
            type: String,
            trim: true,
            maxlength: WORKSPACE_MEMBER_INVITATION_CONSTANTS.MESSAGE.MAX_LENGTH,
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        acceptedAt: {
            type: Date,
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

/**
 * Default workspace invitation list, newest first.
 */
WorkspaceMemberInvitationSchema.index(
    {
        workspaceId: 1,
        createdAt: -1,
    },
    {
        name: "workspace_invitation_list",
    },
);

/**
 * Workspace invitation list when filtering by status, newest first.
 */
WorkspaceMemberInvitationSchema.index(
    {
        workspaceId: 1,
        status: 1,
        createdAt: -1,
    },
    {
        name: "workspace_invitation_status_list",
    },
);

/**
 * Invitation history / lookup for one email inside a workspace.
 */
WorkspaceMemberInvitationSchema.index(
    {
        workspaceId: 1,
        email: 1,
        createdAt: -1,
    },
    {
        name: "workspace_invitation_email_history",
    },
);

/**
 * Invitation history for a registered user inside a workspace.
 */
WorkspaceMemberInvitationSchema.index(
    {
        workspaceId: 1,
        userId: 1,
        createdAt: -1,
    },
    {
        name: "workspace_invitation_user_history",
        partialFilterExpression: {
            userId: {
                $type: "objectId",
            },
        },
    },
);

WorkspaceMemberInvitationSchema.index(
    {
        invitedBy: 1,
        createdAt: -1,
    },
    {
        name: "workspace_invitation_inviter_history",
    },
);

/**
 * Expiry worker / stale-pending cleanup.
 * Equality first, range second.
 */
WorkspaceMemberInvitationSchema.index(
    {
        status: 1,
        expiresAt: 1,
    },
    {
        name: "workspace_invitation_pending_expiry",
    },
);

/**
 * Database-level protection against duplicate pending invitations.
 * Historical accepted/rejected/cancelled/expired invitations may coexist.
 */
WorkspaceMemberInvitationSchema.index(
    {
        workspaceId: 1,
        email: 1,
    },
    {
        unique: true,
        name: "uniq_pending_workspace_invitation_email",
        partialFilterExpression: {
            status: WorkspaceInvitationStatus.PENDING,
        },
    },
);

export const WorkspaceMemberInvitationModel: Model<IWorkspaceMemberInvitationDocument> =
    mongoose.model<IWorkspaceMemberInvitationDocument>(
        "WorkspaceMemberInvitation",
        WorkspaceMemberInvitationSchema,
    );
