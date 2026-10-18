import mongoose, { Schema, Model } from "mongoose";
import type { IWorkspacePermissionDocument } from "../interfaces/workspacepermission.interface.js";

const WorkspacePermissionSchema: Schema<IWorkspacePermissionDocument> = new Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,   // ✅ enough
            trim: true,
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

export const WorkspacePermissionModel: Model<IWorkspacePermissionDocument> =
    mongoose.model<IWorkspacePermissionDocument>(
        "WorkspacePermission",
        WorkspacePermissionSchema
    );