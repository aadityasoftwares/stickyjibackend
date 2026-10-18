import mongoose, { Schema, type Model } from "mongoose";
import { BillingEventProcessingStatus, BillingProviderName } from "../constants/billing.enums.js";
import type { IBillingEventDocument } from "../interfaces/billing.interface.js";

const BillingEventSchema = new Schema<IBillingEventDocument>(
    {
        provider: { type: String, default: BillingProviderName.RAZORPAY, required: true },
        eventId: { type: String, required: true, trim: true },
        eventType: { type: String, required: true, trim: true },
        providerSubscriptionId: { type: String, trim: true, default: null },
        providerPaymentId: { type: String, trim: true, default: null },
        payload: { type: Schema.Types.Mixed, required: true },
        processingStatus: {
            type: String,
            enum: Object.values(BillingEventProcessingStatus),
            default: BillingEventProcessingStatus.RECEIVED,
            required: true,
            index: true,
        },
        attempts: { type: Number, default: 0, min: 0 },
        receivedAt: { type: Date, default: Date.now, required: true },
        processedAt: { type: Date, default: null },
        nextRetryAt: { type: Date, default: null, index: true },
        lastErrorCode: { type: String, default: null },
        lastErrorMessage: { type: String, default: null },
    },
    { timestamps: true, versionKey: false },
);

BillingEventSchema.index(
    { provider: 1, eventId: 1 },
    {
        unique: true,
        name: "uniq_provider_event_id",
    },
);

BillingEventSchema.index({ providerSubscriptionId: 1, createdAt: -1 });
BillingEventSchema.index({ processingStatus: 1, nextRetryAt: 1 });

export const BillingEventModel: Model<IBillingEventDocument> = mongoose.model<IBillingEventDocument>(
    "BillingEvent",
    BillingEventSchema,
);
