import mongoose, { Model, Schema } from "mongoose";
import type { IWorkspaceFolderDocument } from "../interfaces/workspaceFolder.interface.js";
import { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";
import { WORKSPACE_FOLDER_CONSTANTS } from "../constants/workspaceFolder.constants.js";

const WorkspaceFolderSchema = new Schema<IWorkspaceFolderDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: WORKSPACE_FOLDER_CONSTANTS.NAME.MIN_LENGTH,
            maxlength: WORKSPACE_FOLDER_CONSTANTS.NAME.MAX_LENGTH,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: WORKSPACE_FOLDER_CONSTANTS.SLUG.MIN_LENGTH,
            maxlength: WORKSPACE_FOLDER_CONSTANTS.SLUG.MAX_LENGTH,
        },
        description: {
            type: String,
            trim: true,
            maxlength: WORKSPACE_FOLDER_CONSTANTS.DESCRIPTION.MAX_LENGTH,
            default: null,
        },
        icon: {
            type: String,
            trim: true,
            maxlength: WORKSPACE_FOLDER_CONSTANTS.ICON.MAX_LENGTH,
            default: null,
        },
        color: {
            type: String,
            trim: true,
            maxlength: WORKSPACE_FOLDER_CONSTANTS.COLOR.MAX_LENGTH,
            default: null,
        },
        position: {
            type: Number,
            required: true,
            min: WORKSPACE_FOLDER_CONSTANTS.POSITION.MIN,
            default: WORKSPACE_FOLDER_CONSTANTS.POSITION.DEFAULT,
        },
        isDefault: {
            type: Boolean,
            required: true,
            default: WORKSPACE_FOLDER_CONSTANTS.DEFAULT_IS_DEFAULT,
        },
        status: {
            type: String,
            enum: Object.values(WorkspaceFolderStatus),
            required: true,
            default: WorkspaceFolderStatus.ACTIVE,
        },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        purgeAfter: { type: Date, default: null },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

WorkspaceFolderSchema.index(
    { workspaceId: 1, slug: 1 },
    { unique: true, name: "uniq_workspace_folder_slug" },
);
WorkspaceFolderSchema.index({ workspaceId: 1, status: 1, position: 1, _id: 1 });
WorkspaceFolderSchema.index({ status: 1, createdAt: -1 });
WorkspaceFolderSchema.index(
    { workspaceId: 1 },
    {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_folder_per_workspace",
    },
);

export const WorkspaceFolderModel: Model<IWorkspaceFolderDocument> = mongoose.model<IWorkspaceFolderDocument>(
    "WorkspaceFolder",
    WorkspaceFolderSchema,
);
