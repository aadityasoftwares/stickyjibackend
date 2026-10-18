import mongoose, { Schema, Model, } from "mongoose";
import type { ILocalizationDocument, } from "../interfaces/localization.interface.js";
import { LocalizationLanguage, LocalizationDirection, } from "../constants/localization.enums.js";
import { DEFAULT_LOCALIZATION_STATUS, } from "../constants/localization.constants.js";

const LocalizationSchema =
    new Schema<ILocalizationDocument>(
        {
            language: {
                type: String,
                enum: Object.values(
                    LocalizationLanguage
                ),
                required: true,
                trim: true,
            },

            languageCode: {
                type: String,
                required: true,
                trim: true,
                lowercase: true,
            },

            locale: {
                type: String,
                required: true,
                trim: true,
            },

            direction: {
                type: String,
                enum: Object.values(
                    LocalizationDirection
                ),
                required: true,
                default:
                    LocalizationDirection.LTR,
            },

            key: {
                type: String,
                required: true,
                trim: true,
            },

            value: {
                type: String,
                required: true,
                trim: true,
            },

            module: {
                type: String,
                required: true,
                uppercase: true,
                trim: true,
            },

            description: {
                type: String,
                trim: true,
                default: "",
            },

            isActive: {
                type: Boolean,
                default:
                    DEFAULT_LOCALIZATION_STATUS,
            },

            isDefault: {
                type: Boolean,
                default: false,
            },
        },
        {
            timestamps: true,
        }
    );


LocalizationSchema.index(
    {
        locale: 1,
        key: 1,
    },
    {
        unique: true,
    }
);

LocalizationSchema.index({
    languageCode: 1,
});

LocalizationSchema.index({
    locale: 1,
});

LocalizationSchema.index({
    module: 1,
});

LocalizationSchema.index({
    isActive: 1,
});

LocalizationSchema.index({
    isDefault: 1,
});

LocalizationSchema.index({
    locale: 1,
    module: 1,
    isActive: 1,
});

export const LocalizationModel:
    Model<ILocalizationDocument> =
    mongoose.model<ILocalizationDocument>(
        "Localization",
        LocalizationSchema
    );