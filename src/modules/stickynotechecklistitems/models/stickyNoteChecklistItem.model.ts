import mongoose, {
    Model,
    Schema,
} from "mongoose";

import type {
    IStickyNoteChecklistItemDocument,
} from "../interfaces/stickyNoteChecklistItem.interface.js";

import {
    StickyNoteChecklistItemStatus,
} from "../constants/stickyNoteChecklistItem.enums.js";

import {
    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS,
} from "../constants/stickyNoteChecklistItem.constants.js";

const StickyNoteChecklistItemSchema =
    new Schema<IStickyNoteChecklistItemDocument>(
        {
            checklistId: {
                type: Schema.Types.ObjectId,
                ref: "StickyNoteChecklist",
                required: true,
            },

            title: {
                type: String,
                required: true,
                trim: true,
                minlength:
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.TITLE.MIN_LENGTH,
                maxlength:
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.TITLE.MAX_LENGTH,
            },

            position: {
                type: Number,
                required: true,
                min:
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.POSITION.MIN,
                default:
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.POSITION.DEFAULT,
            },

            isCompleted: {
                type: Boolean,
                required: true,
                default:
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.DEFAULT_IS_COMPLETED,
            },

            status: {
                type: String,
                enum:
                    Object.values(
                        StickyNoteChecklistItemStatus,
                    ),
                required: true,
                default:
                    StickyNoteChecklistItemStatus.ACTIVE,
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

            completedBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            completedAt: {
                type: Date,
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
                transform: (
                    _document,
                    returnedObject,
                ) => {
                    const {
                        _id,
                        ...rest
                    } = returnedObject;

                    return {
                        ...rest,
                        id: _id.toString(),
                    };
                },
            },

            toObject: {
                virtuals: true,
                transform: (
                    _document,
                    returnedObject,
                ) => {
                    const {
                        _id,
                        ...rest
                    } = returnedObject;

                    return {
                        ...rest,
                        id: _id.toString(),
                    };
                },
            },
        },
    );

/**
 * Primary checklist-item list/order index.
 * Supports checklist-scoped reads and position ordering.
 */
StickyNoteChecklistItemSchema.index({
    checklistId: 1,
    status: 1,
    position: 1,
});

/**
 * Prevent duplicate non-deleted item titles inside one checklist.
 * Soft-deleted rows leave this partial unique index.
 */
StickyNoteChecklistItemSchema.index(
    {
        checklistId: 1,
        title: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            deletedAt: null,
        },
        collation: {
            locale: "en",
            strength: 2,
        },
        name: "uniq_checklist_item_title",
    },
);

export const StickyNoteChecklistItemModel:
    Model<IStickyNoteChecklistItemDocument> =
    mongoose.model<IStickyNoteChecklistItemDocument>(
        "StickyNoteChecklistItem",
        StickyNoteChecklistItemSchema,
    );
