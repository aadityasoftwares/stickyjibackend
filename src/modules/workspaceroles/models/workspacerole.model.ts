import mongoose, { Schema, Model } from "mongoose";
import type { IWorkspaceRoleDocument } from "../interfaces/workspacerole.interface.js";

const WorkspaceRoleSchema: Schema<IWorkspaceRoleDocument> = new Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
        },

        permissions: [
            {
                type: Schema.Types.ObjectId,
                ref: "WorkspacePermission",
            },
        ],

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

WorkspaceRoleSchema.index({ key: 1 }, { unique: true });

export const WorkspaceRoleModel: Model<IWorkspaceRoleDocument> =
    mongoose.model<IWorkspaceRoleDocument>("WorkspaceRole", WorkspaceRoleSchema);