import mongoose, { Schema, Model, } from "mongoose";
import { PlanFeatureLimitType } from "../constants/planFeature.enums.js";
import {
    DEFAULT_PLAN_FEATURE_STATUS,
    DEFAULT_PLAN_FEATURE_LIMIT_TYPE,
    DEFAULT_PLAN_FEATURE_LIMIT,
    DEFAULT_PLAN_FEATURE_UNLIMITED,
    DEFAULT_PLAN_FEATURE_SORT_ORDER,
} from "../constants/planFeature.constants.js";
import { IPlanFeatureDocument } from "../interfaces/planfeature.interface.js";

const PlanFeatureSchema = new Schema<IPlanFeatureDocument>(
    {
        planId: {
            type: Schema.Types.ObjectId,
            ref: "Plan",
            required: true,
        },

        featureId: {
            type: Schema.Types.ObjectId,
            ref: "Feature",
            required: true,
        },

        isEnabled: {
            type: Boolean,
            default: DEFAULT_PLAN_FEATURE_STATUS,
        },

        limit: {
            type: Number,
            min: 0,
            default: DEFAULT_PLAN_FEATURE_LIMIT,
        },

        limitType: {
            type: String,
            enum: Object.values(
                PlanFeatureLimitType
            ),
            required: true,
            default: DEFAULT_PLAN_FEATURE_LIMIT_TYPE,
        },

        isUnlimited: {
            type: Boolean,
            default: DEFAULT_PLAN_FEATURE_UNLIMITED,
        },

        sortOrder: {
            type: Number,
            default: DEFAULT_PLAN_FEATURE_SORT_ORDER,
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

PlanFeatureSchema.index(
    {
        planId: 1,
        featureId: 1,
    },
    {
        unique: true,
    }
);

PlanFeatureSchema.index({
    planId: 1,
});

PlanFeatureSchema.index({
    featureId: 1,
});

PlanFeatureSchema.index({
    limitType: 1,
});

PlanFeatureSchema.index({
    isEnabled: 1,
});

PlanFeatureSchema.index({
    isUnlimited: 1,
});

PlanFeatureSchema.index({
    sortOrder: 1,
});

PlanFeatureSchema.index({
    planId: 1,
    isEnabled: 1,
});

PlanFeatureSchema.index({
    featureId: 1,
    isEnabled: 1,
});

export const PlanFeatureModel:
    Model<IPlanFeatureDocument> =
    mongoose.model<IPlanFeatureDocument>(
        "PlanFeature",
        PlanFeatureSchema
    );