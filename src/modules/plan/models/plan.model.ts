import mongoose, { Schema, type Model } from "mongoose";
import type { IPlanDocument } from "../interfaces/plan.interface.js";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../constants/plan.enums.js";
import {
    DEFAULT_PLAN_DEFAULT,
    DEFAULT_PLAN_PRICING_MODEL,
    DEFAULT_PLAN_SORT_ORDER,
    DEFAULT_PLAN_STATUS,
    DEFAULT_PLAN_SYSTEM,
    DEFAULT_PLAN_TRIAL_DAYS,
    DEFAULT_PLAN_TYPE,
    DEFAULT_PLAN_VISIBILITY,
} from "../constants/plan.constants.js";

const PlanSchema = new Schema<IPlanDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            enum: Object.values(PlanCode),
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
        type: {
            type: String,
            enum: Object.values(PlanType),
            required: true,
            default: DEFAULT_PLAN_TYPE,
        },
        pricingModel: {
            type: String,
            enum: Object.values(PlanPricingModel),
            required: true,
            default: DEFAULT_PLAN_PRICING_MODEL,
        },
        trialDays: {
            type: Number,
            min: 0,
            default: DEFAULT_PLAN_TRIAL_DAYS,
        },
        visibility: {
            type: String,
            enum: Object.values(PlanVisibility),
            required: true,
            default: DEFAULT_PLAN_VISIBILITY,
        },
        isPopular: {
            type: Boolean,
            default: false,
        },
        sortOrder: {
            type: Number,
            default: DEFAULT_PLAN_SORT_ORDER,
        },
        isDefault: {
            type: Boolean,
            default: DEFAULT_PLAN_DEFAULT,
        },
        isSystem: {
            type: Boolean,
            default: DEFAULT_PLAN_SYSTEM,
        },
        isActive: {
            type: Boolean,
            default: DEFAULT_PLAN_STATUS,
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

PlanSchema.index({ name: 1 });
PlanSchema.index({ type: 1 });
PlanSchema.index({ pricingModel: 1 });
PlanSchema.index({ visibility: 1 });
PlanSchema.index({ isPopular: 1 });
PlanSchema.index({ sortOrder: 1 });
PlanSchema.index({ isActive: 1 });
PlanSchema.index(
    { isDefault: 1 },
    {
        unique: true,
        partialFilterExpression: { isDefault: true },
        name: "uniq_default_plan",
    },
);
PlanSchema.index({ isSystem: 1 });
PlanSchema.index({ isActive: 1, isDefault: 1 });
PlanSchema.index({ visibility: 1, isActive: 1 });

export const PlanModel: Model<IPlanDocument> = mongoose.model<IPlanDocument>("Plan", PlanSchema);
