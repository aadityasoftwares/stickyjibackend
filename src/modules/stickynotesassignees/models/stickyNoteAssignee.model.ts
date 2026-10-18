import mongoose, {
    Model,
    Schema,
} from "mongoose";

import {
    StickyNoteAssigneeStatus,
} from "../constants/stickyNoteAssignee.enums.js";

import type {
    IStickyNoteAssigneeDocument,
} from "../interfaces/stickyNoteAssignee.interface.js";

const StickyNoteAssigneeSchema =
    new Schema<IStickyNoteAssigneeDocument>(
        {
            workspaceId: {
                type: Schema.Types.ObjectId,
                ref: "Workspace",
                required: true,
            },

            stickyNoteId: {
                type: Schema.Types.ObjectId,
                ref: "StickyNote",
                required: true,
            },

            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            status: {
                type: String,
                enum: Object.values(
                    StickyNoteAssigneeStatus,
                ),
                required: true,
                default:
                    StickyNoteAssigneeStatus.ACTIVE,
            },

            assignedBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            removedBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            assignedAt: {
                type: Date,
                required: true,
                default: Date.now,
            },

            removedAt: {
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
                        __v: _version,
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
                        __v: _version,
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
 * One relation per note + user for the full lifetime of the note.
 * Removed assignees are reactivated instead of creating duplicates.
 */
StickyNoteAssigneeSchema.index(
    {
        stickyNoteId: 1,
        userId: 1,
    },
    {
        unique: true,
        name:
            "sticky_note_assignee_note_user_unique",
    },
);

/**
 * Fast note-card/detail lookup of active assignees.
 */
StickyNoteAssigneeSchema.index(
    {
        stickyNoteId: 1,
        status: 1,
        assignedAt: 1,
    },
    {
        name:
            "sticky_note_assignee_note_status_assigned_at",
    },
);

/**
 * Fast "Assigned to me" queries inside a workspace.
 */
StickyNoteAssigneeSchema.index(
    {
        workspaceId: 1,
        userId: 1,
        status: 1,
        assignedAt: -1,
    },
    {
        name:
            "sticky_note_assignee_workspace_user_status_assigned_at",
    },
);

/**
 * Workspace assignment administration/listing.
 */
StickyNoteAssigneeSchema.index(
    {
        workspaceId: 1,
        status: 1,
        assignedAt: -1,
    },
    {
        name:
            "sticky_note_assignee_workspace_status_assigned_at",
    },
);

export const StickyNoteAssigneeModel:
    Model<IStickyNoteAssigneeDocument> =
    mongoose.model<IStickyNoteAssigneeDocument>(
        "StickyNoteAssignee",
        StickyNoteAssigneeSchema,
    );
