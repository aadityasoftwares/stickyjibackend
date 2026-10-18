import mongoose, { Schema, Model, } from "mongoose";
import type { IPlanPriceDocument, } from "../interfaces/planPrice.interface.js";
import { BillingInterval, } from "../constants/planPrice.enums.js";
import { DEFAULT_PLAN_PRICE_STATUS, DEFAULT_PLAN_PRICE_SORT_ORDER, } from "../constants/planPrice.constants.js";

const PlanPriceSchema =
    new Schema<IPlanPriceDocument>(
        {
            planId: {
                type: Schema.Types.ObjectId,
                ref: "Plan",
                required: true,
                index: true,
            },

            currencyId: {
                type: Schema.Types.ObjectId,
                ref: "Currency",
                required: true,
                index: true,
            },

            billingInterval: {
                type: String,
                enum: Object.values(BillingInterval),
                required: true,
                index: true,
            },

            amountMinor: {
                type: Number,
                required: true,
                min: 1,
                validate: {
                    validator: Number.isInteger,
                    message: "Price amount must be an integer.",
                },
            },

            sortOrder: {
                type: Number,
                default: DEFAULT_PLAN_PRICE_SORT_ORDER,
            },

            isActive: {
                type: Boolean,
                default: DEFAULT_PLAN_PRICE_STATUS,
                index: true,
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
            toJSON: {
                transform: (
                    _doc,
                    ret: Record<string, any>
                ) => {
                    delete ret.__v;
                    return ret;
                },
            },
        }
    );


PlanPriceSchema.index(
    {
        planId: 1,
        currencyId: 1,
        billingInterval: 1,
    },
    {
        unique:
            true,
    }
);

PlanPriceSchema.index({
    planId: 1,
    isActive: 1,
});

PlanPriceSchema.index({
    currencyId: 1,
    isActive: 1,
});

PlanPriceSchema.index({
    billingInterval: 1,
    isActive: 1,
});

PlanPriceSchema.index({
    sortOrder: 1,
});

export const PlanPriceModel:
    Model<IPlanPriceDocument> =
    mongoose.model<IPlanPriceDocument>(
        "PlanPrice",
        PlanPriceSchema
    );