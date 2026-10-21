import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { IStickyNoteDocument } from "../interfaces/stickynote.interface.js";
import {
    StickyNoteBackgroundPattern,
    StickyNoteColor,
    StickyNotePriority,
    StickyNoteShape,
    StickyNoteStatus,
    StickyNoteVariant,
} from "../constants/stickyNote.enums.js";
import { STICKY_NOTE_CONSTANTS as C } from "../constants/stickyNote.constants.js";
import { RankUtil } from "../../../utils/rank.util.js";
const isValidNoteDate = (value: string | null | undefined): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value !== "string" || !C.DATE.PATTERN.test(value)) return false;
    const year = Number(value.slice(0, 4)),
        month = Number(value.slice(5, 7)),
        day = Number(value.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const LEGACY_STICKY_NOTE_SHAPES = ["NOTE", "ROUNDED", "SOFT", "CUT", "TICKET", "FOLDED"] as const;
const StickyNoteSchema = new Schema<IStickyNoteDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        workspaceFolderId: {
            type: Schema.Types.ObjectId,
            ref: "WorkspaceFolder",
            default: null,
        },
        columnId: {
            type: Schema.Types.ObjectId,
            ref: "StickyNoteColumn",
            required: true,
        },
        stickyNoteNumber: { type: Number, required: true, min: 1, immutable: true },
        title: {
            type: String,
            trim: true,
            minlength: C.TITLE.MIN_LENGTH,
            maxlength: C.TITLE.MAX_LENGTH,
            default: "",
        },
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: C.CONTENT.MIN_LENGTH,
            maxlength: C.CONTENT.MAX_LENGTH,
        },
        color: {
            type: String,
            enum: Object.values(StickyNoteColor),
            required: true,
            default: C.DEFAULT_COLOR,
        },
        priority: {
            type: String,
            enum: Object.values(StickyNotePriority),
            required: true,
            default: C.DEFAULT_PRIORITY,
        },
        shape: {
            type: String,
            enum: [...Object.values(StickyNoteShape), ...LEGACY_STICKY_NOTE_SHAPES],
            required: true,
            default: C.DEFAULT_SHAPE,
        },
        variant: {
            type: String,
            enum: Object.values(StickyNoteVariant),
            required: true,
            default: C.DEFAULT_VARIANT,
        },
        backgroundPattern: {
            type: String,
            enum: Object.values(StickyNoteBackgroundPattern),
            required: true,
            default: C.DEFAULT_BACKGROUND_PATTERN,
        },
        position: {
            type: Number,
            required: true,
            min: C.POSITION.MIN,
            default: C.POSITION.DEFAULT,
        },
        rank: {
            type: String,
            required: true,
            trim: true,
            default: () => RankUtil.generateInitialRank(),
        },
        status: {
            type: String,
            enum: Object.values(StickyNoteStatus),
            required: true,
            default: C.DEFAULT_STATUS,
        },
        noteDate: {
            type: String,
            default: null,
            trim: true,
            validate: {
                validator: isValidNoteDate,
                message: "noteDate must be a valid calendar date in YYYY-MM-DD format.",
            },
        },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        archivedAt: { type: Date, default: null },
        archivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        purgeAfter: { type: Date, default: null },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);
StickyNoteSchema.virtual("noteKey").get(function () {
    return this.stickyNoteNumber ? `ST-${String(this.stickyNoteNumber).padStart(6, "0")}` : undefined;
});
StickyNoteSchema.index(
    { workspaceId: 1, status: 1, createdAt: -1 },
    { name: "sticky_note_workspace_status_created_at" },
);
StickyNoteSchema.index(
    { workspaceId: 1, status: 1, noteDate: 1, createdAt: -1 },
    { name: "sticky_note_workspace_status_note_date_created_at" },
);
StickyNoteSchema.index(
    { workspaceFolderId: 1, status: 1, position: 1 },
    { name: "sticky_note_folder_status_position" },
);
StickyNoteSchema.index(
    { workspaceFolderId: 1, status: 1, noteDate: 1, position: 1 },
    { name: "sticky_note_folder_status_note_date_position" },
);
StickyNoteSchema.index(
    { columnId: 1, status: 1, position: 1 },
    { name: "sticky_note_column_status_position" },
);
StickyNoteSchema.index(
    { columnId: 1, status: 1, rank: 1, position: 1 },
    { name: "sticky_note_column_status_rank_position" },
);
StickyNoteSchema.index(
    { workspaceFolderId: 1, status: 1, rank: 1, position: 1 },
    { name: "sticky_note_folder_status_rank_position" },
);
StickyNoteSchema.index(
    { workspaceId: 1, createdBy: 1, status: 1, createdAt: -1 },
    { name: "sticky_note_workspace_creator_status_created_at" },
);
StickyNoteSchema.index(
    { workspaceId: 1, status: 1, color: 1, shape: 1, variant: 1 },
    { name: "sticky_note_workspace_status_presentation" },
);
StickyNoteSchema.index({ status: 1, purgeAfter: 1 }, { name: "sticky_note_status_purge_after" });
StickyNoteSchema.index(
    { title: "text", content: "text" },
    { name: "sticky_note_text_search", weights: { title: 5, content: 1 } },
);
StickyNoteSchema.index(
    { workspaceId: 1, stickyNoteNumber: 1 },
    { name: "sticky_note_workspace_number", unique: true },
);
export const StickyNoteModel: Model<IStickyNoteDocument> =
    (mongoose.models.StickyNote as Model<IStickyNoteDocument> | undefined) ??
    mongoose.model<IStickyNoteDocument>("StickyNote", StickyNoteSchema);
