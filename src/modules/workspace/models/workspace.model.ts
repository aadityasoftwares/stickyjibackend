import mongoose, { Model, Schema } from "mongoose";
import type { IWorkspaceDocument } from "../interfaces/workspace.interface.js";
import { WorkspaceStatus, WorkspaceVisibility } from "../constants/workspace.enums.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";

const WorkspaceSchema = new Schema<IWorkspaceDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: WORKSPACE_CONSTANTS.NAME.MIN_LENGTH,
            maxlength: WORKSPACE_CONSTANTS.NAME.MAX_LENGTH,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: WORKSPACE_CONSTANTS.SLUG.MIN_LENGTH,
            maxlength: WORKSPACE_CONSTANTS.SLUG.MAX_LENGTH,
        },
        description: { type: String, trim: true, maxlength: WORKSPACE_CONSTANTS.DESCRIPTION.MAX_LENGTH, default: null },
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: Object.values(WorkspaceStatus), required: true, default: WorkspaceStatus.ACTIVE },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        purgeAfter: { type: Date, default: null },
        visibility: {
            type: String,
            enum: Object.values(WorkspaceVisibility),
            required: true,
            default: WORKSPACE_CONSTANTS.DEFAULT_VISIBILITY,
        },
        isPersonal: { type: Boolean, required: true, default: WORKSPACE_CONSTANTS.DEFAULT_PERSONAL_WORKSPACE },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true, versionKey: false },
);

WorkspaceSchema.index({ slug: 1 }, { unique: true, name: "uniq_workspace_slug" });
WorkspaceSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
WorkspaceSchema.index({ status: 1, createdAt: -1 });
WorkspaceSchema.index({ status: 1, purgeAfter: 1 }, { name: "workspace_status_purge_after" });
WorkspaceSchema.index({ visibility: 1, status: 1, createdAt: -1 });
WorkspaceSchema.index(
    { ownerId: 1 },
    { unique: true, partialFilterExpression: { isPersonal: true }, name: "uniq_personal_workspace_per_owner" },
);

export const WorkspaceModel: Model<IWorkspaceDocument> = mongoose.model<IWorkspaceDocument>(
    "Workspace",
    WorkspaceSchema,
);
