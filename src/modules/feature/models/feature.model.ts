import mongoose, { Schema, Model } from "mongoose";
import type { IFeatureDocument } from "../interfaces/feature.interface.js";
import { FeatureCode, FeatureCategory, FeatureType } from "../constants/feature.enums.js";
import {
    DEFAULT_FEATURE_STATUS,
    DEFAULT_FEATURE_SYSTEM,
    DEFAULT_FEATURE_TYPE,
    DEFAULT_FEATURE_CATEGORY,
} from "../constants/feature.constants.js";

const FeatureSchema = new Schema<IFeatureDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            enum: Object.values(FeatureCode),
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },

        description: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            enum: Object.values(FeatureCategory),
            required: true,
            default: DEFAULT_FEATURE_CATEGORY,
        },

        type: {
            type: String,
            enum: Object.values(FeatureType),
            required: true,
            default: DEFAULT_FEATURE_TYPE,
        },

        isDefault: {
            type: Boolean,
            default: false,
        },

        isSystem: {
            type: Boolean,
            default: DEFAULT_FEATURE_SYSTEM,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_FEATURE_STATUS,
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
    },
);

FeatureSchema.index({ code: 1 }, { unique: true });

FeatureSchema.index({
    name: 1,
});

FeatureSchema.index({
    category: 1,
});

FeatureSchema.index({
    type: 1,
});

FeatureSchema.index({
    isActive: 1,
});

FeatureSchema.index({
    isDefault: 1,
});

FeatureSchema.index({
    isSystem: 1,
});

FeatureSchema.index({
    isActive: 1,
    isDefault: 1,
});

FeatureSchema.index({
    category: 1,
    isActive: 1,
});

export const FeatureModel: Model<IFeatureDocument> = mongoose.model<IFeatureDocument>(
    "Feature",
    FeatureSchema,
);
