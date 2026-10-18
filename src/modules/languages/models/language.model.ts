import mongoose, { Schema, Model, } from "mongoose";
import type { ILanguageDocument, } from "../interfaces/language.interface.js";
import { LanguageDirection, LanguageCode, } from "../constants/language.enums.js";
import { DEFAULT_LANGUAGE_STATUS, DEFAULT_LANGUAGE_DIRECTION, } from "../constants/language.constants.js";

const LanguageSchema = new Schema<ILanguageDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        nativeName: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            enum: Object.values(LanguageCode),
            required: true,
            lowercase: true,
            trim: true,
            unique: true,
        },

        locale: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        direction: {
            type: String,
            enum: Object.values(LanguageDirection),
            required: true,
            default: DEFAULT_LANGUAGE_DIRECTION,
        },

        isDefault: {
            type: Boolean,
            default: false,
        },

        isSystem: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_LANGUAGE_STATUS,
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
    },
    {
        timestamps: true,
    }
);

LanguageSchema.index(
    { code: 1 },
    { unique: true }
);

LanguageSchema.index(
    { locale: 1 },
    { unique: true }
);

LanguageSchema.index({
    name: 1,
});

LanguageSchema.index({
    nativeName: 1,
});

LanguageSchema.index({
    isActive: 1,
});

LanguageSchema.index({
    isDefault: 1,
});

LanguageSchema.index({
    isSystem: 1,
});

LanguageSchema.index({
    isActive: 1,
    isDefault: 1,
});

export const LanguageModel:
    Model<ILanguageDocument> =
    mongoose.model<ILanguageDocument>(
        "Language",
        LanguageSchema
    );