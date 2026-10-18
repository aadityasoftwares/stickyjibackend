import mongoose, { Model, Schema } from "mongoose";
import { StickyNoteColumnColor, StickyNoteColumnType } from "../constants/stickyNoteColumn.enums.js";
import { STICKY_NOTE_COLUMN_CONSTANTS } from "../constants/stickyNoteColumn.constants.js";
import { RankUtil } from "../../../utils/rank.util.js";
import type { IStickyNoteColumnDocument } from "../interfaces/stickyNoteColumn.interface.js";

const StickyNoteColumnSchema = new Schema<IStickyNoteColumnDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        workspaceFolderId: {
            type: Schema.Types.ObjectId,
            ref: "WorkspaceFolder",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: STICKY_NOTE_COLUMN_CONSTANTS.NAME.MIN_LENGTH,
            maxlength: STICKY_NOTE_COLUMN_CONSTANTS.NAME.MAX_LENGTH,
        },
        type: {
            type: String,
            enum: Object.values(StickyNoteColumnType),
            required: true,
            default: StickyNoteColumnType.CUSTOM,
        },
        color: {
            type: String,
            enum: Object.values(StickyNoteColumnColor),
            required: true,
            default: StickyNoteColumnColor.YELLOW,
        },
        position: {
            type: Number,
            required: true,
            min: STICKY_NOTE_COLUMN_CONSTANTS.POSITION.MIN,
            default: STICKY_NOTE_COLUMN_CONSTANTS.POSITION.DEFAULT,
        },
        rank: {
            type: String,
            required: true,
            trim: true,
            default: () => RankUtil.generateInitialRank(),
        },
        isSystem: {
            type: Boolean,
            required: true,
            default: false,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
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
 * Main board-column query.
 * Covers: get all columns for a workspace folder, count by workspace folder,
 * stable position ordering, highest-position lookup.
 */
StickyNoteColumnSchema.index({ workspaceId: 1, workspaceFolderId: 1, position: 1, _id: 1 });
StickyNoteColumnSchema.index({ workspaceId: 1, workspaceFolderId: 1, rank: 1, position: 1, _id: 1 });

/**
 * Column names are unique inside one folder, case-insensitively.
 */
StickyNoteColumnSchema.index(
    { workspaceId: 1, workspaceFolderId: 1, name: 1 },
    {
        unique: true,
        collation: { locale: "en", strength: 2 },
        name: "uniq_column_name_per_folder",
    },
);

/**
 * There can be only one system TODO / IN_PROGRESS / COMPLETED column of each type per folder.
 */
StickyNoteColumnSchema.index(
    { workspaceId: 1, workspaceFolderId: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { isSystem: true },
        name: "uniq_system_column_type_per_folder",
    },
);

export const StickyNoteColumnModel: Model<IStickyNoteColumnDocument> =
    mongoose.model<IStickyNoteColumnDocument>("StickyNoteColumn", StickyNoteColumnSchema);
