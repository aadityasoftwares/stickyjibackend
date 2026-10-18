import mongoose, { Model, Schema } from "mongoose";

import type { IStickyNoteChecklistDocument } from "../interfaces/stickyNoteChecklist.interface.js";

import { StickyNoteChecklistStatus } from "../constants/stickyNoteChecklist.enums.js";

import { STICKY_NOTE_CHECKLIST_CONSTANTS } from "../constants/stickyNoteChecklist.constants.js";

const StickyNoteChecklistSchema = new Schema<IStickyNoteChecklistDocument>(
    {
        stickyNoteId: {
            type: Schema.Types.ObjectId,
            ref: "StickyNote",
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            minlength: STICKY_NOTE_CHECKLIST_CONSTANTS.TITLE.MIN_LENGTH,
            maxlength: STICKY_NOTE_CHECKLIST_CONSTANTS.TITLE.MAX_LENGTH,
        },

        position: {
            type: Number,
            required: true,
            min: STICKY_NOTE_CHECKLIST_CONSTANTS.POSITION.MIN,
            default: STICKY_NOTE_CHECKLIST_CONSTANTS.POSITION.DEFAULT,
        },

        status: {
            type: String,
            enum: Object.values(StickyNoteChecklistStatus),
            required: true,
            default: StickyNoteChecklistStatus.ACTIVE,
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
        versionKey: false,

        toJSON: {
            virtuals: true,
            transform: (_document, returnedObject) => {
                const { _id, ...rest } = returnedObject;

                return {
                    ...rest,
                    id: _id.toString(),
                };
            },
        },

        toObject: {
            virtuals: true,
            transform: (_document, returnedObject) => {
                const { _id, ...rest } = returnedObject;

                return {
                    ...rest,
                    id: _id.toString(),
                };
            },
        },
    },
);

StickyNoteChecklistSchema.virtual("items", {
    ref: "StickyNoteChecklistItem",
    localField: "_id",
    foreignField: "checklistId",
    justOne: false,
});

/**
 * Main list/order index.
 *
 * Used by:
 * - GET checklist list for one sticky note
 * - max-count checks
 * - ordered checklist reads
 */
StickyNoteChecklistSchema.index({
    stickyNoteId: 1,
    status: 1,
    position: 1,
});

/**
 * Prevent duplicate non-deleted titles inside the same sticky note.
 *
 * Active/archived rows have deletedAt = null, so the combination is unique.
 * Once soft-deleted, deletedAt becomes a timestamp and the same title may be
 * created again. Collation makes title uniqueness case-insensitive.
 */
StickyNoteChecklistSchema.index(
    {
        stickyNoteId: 1,
        title: 1,
        deletedAt: 1,
    },
    {
        unique: true,
        collation: {
            locale: "en",
            strength: 2,
        },
        name: "uniq_checklist_title_per_note",
    },
);

export const StickyNoteChecklistModel: Model<IStickyNoteChecklistDocument> =
    mongoose.model<IStickyNoteChecklistDocument>("StickyNoteChecklist", StickyNoteChecklistSchema);
