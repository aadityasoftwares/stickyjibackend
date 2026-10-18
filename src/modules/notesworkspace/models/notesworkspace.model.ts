import { Schema, model } from "mongoose";
import type { INotesWorkspaceDocument } from "../interfaces/notesworkspace.interface.js";

const NotesWorkspaceSchema = new Schema<INotesWorkspaceDocument>(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        visibility: {
            type: String,
            enum: ["private", "team", "public"],
            default: "private",
            index: true,
        },

        backgroundColor: {
            type: String,
            default: "#F8F9FA",
        },

        backgroundImage: {
            type: Schema.Types.ObjectId,
            ref: "StickyNoteAttachment",
            default: null,
        },

        backgroundImageUrl: {
            type: String,
            default: "",
        },

        members: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        isArchived: {
            type: Boolean,
            default: false,
            index: true,
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

NotesWorkspaceSchema.index({
    owner: 1,
    isArchived: 1,
});

NotesWorkspaceSchema.index({
    owner: 1,
    title: 1,
});

NotesWorkspaceSchema.index({
    visibility: 1,
});

export const NotesWorkspaceModel = model<INotesWorkspaceDocument>(
    "NotesWorkspace",
    NotesWorkspaceSchema
);