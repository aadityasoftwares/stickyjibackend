import mongoose, { Schema, type Model } from "mongoose";
import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { BillingProviderName, CheckoutIntentStatus } from "../constants/billing.enums.js";
import type { ICheckoutIntentDocument } from "../interfaces/billing.interface.js";

const CheckoutIntentSchema = new Schema<ICheckoutIntentDocument>(
    {
        checkoutIntentId: { type: String, required: true, unique: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
        planPriceId: { type: Schema.Types.ObjectId, ref: "PlanPrice", required: true },
        billingInterval: { type: String, enum: Object.values(BillingInterval), required: true },
        provider: { type: String, default: BillingProviderName.RAZORPAY, required: true },
        providerSubscriptionId: { type: String, required: true, trim: true },
        amountMinor: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true, uppercase: true, trim: true },
        status: {
            type: String,
            enum: Object.values(CheckoutIntentStatus),
            default: CheckoutIntentStatus.PENDING,
            required: true,
            index: true,
        },
        expiresAt: { type: Date, required: true, index: true },
        metadata: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true, versionKey: false },
);

CheckoutIntentSchema.index(
    { provider: 1, providerSubscriptionId: 1 },
    {
        unique: true,
        name: "uniq_checkout_intent_provider_subscription",
    },
);

CheckoutIntentSchema.index({ user: 1, status: 1, createdAt: -1 });

export const CheckoutIntentModel: Model<ICheckoutIntentDocument> = mongoose.model<ICheckoutIntentDocument>(
    "CheckoutIntent",
    CheckoutIntentSchema,
);
