import mongoose, { Schema, type Model } from "mongoose";
import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { PaymentProvider, PaymentStatus } from "../constants/subscriptionpayment.enums.js";
import type { ISubscriptionPaymentDocument } from "../interfaces/subscriptionpayment.interface.js";

const SubscriptionPaymentSchema = new Schema<ISubscriptionPaymentDocument>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "UserSubscription", default: null },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    planPriceId: { type: Schema.Types.ObjectId, ref: "PlanPrice", default: null },
    billingInterval: { type: String, enum: Object.values(BillingInterval), required: true },
    provider: { type: String, default: PaymentProvider.RAZORPAY, required: true },
    providerPaymentId: { type: String, trim: true, default: null },
    providerSubscriptionId: { type: String, trim: true, default: null },
    providerOrderId: { type: String, trim: true, default: null },
    providerSignature: { type: String, trim: true, default: null },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    status: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.INITIATED,
        required: true,
    },
    billingPeriodStart: { type: Date, default: null },
    billingPeriodEnd: { type: Date, default: null },
    capturedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true, versionKey: false });

SubscriptionPaymentSchema.index({ user: 1, createdAt: -1 });
SubscriptionPaymentSchema.index({ subscriptionId: 1, createdAt: -1 });
SubscriptionPaymentSchema.index({ providerSubscriptionId: 1, createdAt: -1 });
SubscriptionPaymentSchema.index({ status: 1, createdAt: -1 });
SubscriptionPaymentSchema.index({ provider: 1, providerPaymentId: 1 }, {
    unique: true,
    partialFilterExpression: {
        providerPaymentId: { $type: "string", $gt: "" },
    },
    name: "uniq_provider_payment_id",
});

export const SubscriptionPaymentModel: Model<ISubscriptionPaymentDocument> =
    mongoose.model<ISubscriptionPaymentDocument>("SubscriptionPayment", SubscriptionPaymentSchema);
