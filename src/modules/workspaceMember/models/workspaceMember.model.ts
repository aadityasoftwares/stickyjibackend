import mongoose, { Model, Schema } from "mongoose";
import type { IWorkspaceMemberDocument } from "../interfaces/workspaceMember.interface.js";
import { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";
import { WORKSPACE_MEMBER_CONSTANTS } from "../constants/workspaceMember.constants.js";

const WorkspaceMemberSchema = new Schema<IWorkspaceMemberDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
            index: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        roleId: {
            type: Schema.Types.ObjectId,
            ref: "Role",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(WorkspaceMemberStatus),
            required: true,
            default: WORKSPACE_MEMBER_CONSTANTS.STATUS.DEFAULT,
            index: true,
        },
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        joinedAt: {
            type: Date,
            default: null,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
    },
    { timestamps: true },
);

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
WorkspaceMemberSchema.index({ workspaceId: 1, status: 1 });
WorkspaceMemberSchema.index({ workspaceId: 1, roleId: 1 });
WorkspaceMemberSchema.index({ userId: 1, status: 1 });
WorkspaceMemberSchema.index({ workspaceId: 1, createdAt: -1 });
WorkspaceMemberSchema.index({ workspaceId: 1, updatedAt: -1 });

export const WorkspaceMemberModel: Model<IWorkspaceMemberDocument> = mongoose.model<IWorkspaceMemberDocument>(
    "WorkspaceMember",
    WorkspaceMemberSchema,
);
