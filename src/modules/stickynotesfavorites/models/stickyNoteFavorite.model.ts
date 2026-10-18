import mongoose, {
    Model,
    Schema,
} from "mongoose";

import type {
    IStickyNoteFavoriteDocument,
} from "../interfaces/stickyNoteFavorite.interface.js";

import {
    StickyNoteFavoriteStatus,
} from "../constants/stickyNoteFavorite.enums.js";

const StickyNoteFavoriteSchema =
    new Schema<IStickyNoteFavoriteDocument>(
        {
            stickyNoteId: {
                type: Schema.Types.ObjectId,
                ref: "StickyNote",
                required: true,
                index: true,
            },

            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
                index: true,
            },

            status: {
                type: String,
                enum: Object.values(
                    StickyNoteFavoriteStatus,
                ),
                required: true,
                default: StickyNoteFavoriteStatus.ACTIVE,
                index: true,
            },

            deletedAt: {
                type: Date,
                default: null,
            },
        },
        {
            timestamps: true,
            versionKey: false,
            toJSON: { virtuals: true },
            toObject: { virtuals: true },
        },
    );

StickyNoteFavoriteSchema.index(
    {
        userId: 1,
        stickyNoteId: 1,
    },
    {
        name: "sticky_note_favorite_user_note_unique",
        unique: true,
    },
);

StickyNoteFavoriteSchema.index(
    {
        userId: 1,
        status: 1,
        createdAt: -1,
    },
    {
        name: "sticky_note_favorite_user_status_created_at",
    },
);

StickyNoteFavoriteSchema.index(
    {
        stickyNoteId: 1,
        status: 1,
    },
    {
        name: "sticky_note_favorite_note_status",
    },
);

export const StickyNoteFavoriteModel: Model<IStickyNoteFavoriteDocument> =
    mongoose.model<IStickyNoteFavoriteDocument>(
        "StickyNoteFavorite",
        StickyNoteFavoriteSchema,
    );