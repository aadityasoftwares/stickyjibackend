import mongoose, { Model, Schema } from "mongoose";
import type { IStickyNoteLabelDocument } from "../interfaces/stickyNoteLabel.interface.js";
import { StickyNoteLabelColor, StickyNoteLabelStatus } from "../constants/stickyNoteLabel.enums.js";

import { STICKY_NOTE_LABEL_CONSTANTS } from "../constants/stickyNoteLabel.constants.js";

const StickyNoteLabelSchema = new Schema<IStickyNoteLabelDocument>(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: STICKY_NOTE_LABEL_CONSTANTS.NAME.MIN_LENGTH,
            maxlength: STICKY_NOTE_LABEL_CONSTANTS.NAME.MAX_LENGTH,
        },
        slug: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            minlength: STICKY_NOTE_LABEL_CONSTANTS.SLUG.MIN_LENGTH,
            maxlength: STICKY_NOTE_LABEL_CONSTANTS.SLUG.MAX_LENGTH,
        },
        color: {
            type: String,
            enum: Object.values(StickyNoteLabelColor),
            required: true,
            default: StickyNoteLabelColor.BLUE,
            index: true,
        },
        position: {
            type: Number,
            required: true,
            min: STICKY_NOTE_LABEL_CONSTANTS.POSITION.MIN,
            default: STICKY_NOTE_LABEL_CONSTANTS.POSITION.DEFAULT,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(StickyNoteLabelStatus),
            required: true,
            default: StickyNoteLabelStatus.ACTIVE,
            index: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        archivedAt: {
            type: Date,
            default: null,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

StickyNoteLabelSchema.index(
    {
        workspaceId: 1,
        slug: 1,
    },
    {
        unique: true,
    },
);

StickyNoteLabelSchema.index({
    workspaceId: 1,
    status: 1,
});

StickyNoteLabelSchema.index({
    workspaceId: 1,
    color: 1,
});

StickyNoteLabelSchema.index({
    workspaceId: 1,
    position: 1,
});

StickyNoteLabelSchema.index({
    workspaceId: 1,
    createdAt: -1,
});

StickyNoteLabelSchema.index({
    createdBy: 1,
    createdAt: -1,
});

StickyNoteLabelSchema.index({
    workspaceId: 1,
    status: 1,
    position: 1,
});

export const StickyNoteLabelModel: Model<IStickyNoteLabelDocument> = mongoose.model<IStickyNoteLabelDocument>(
    "StickyNoteLabel",
    StickyNoteLabelSchema,
);
