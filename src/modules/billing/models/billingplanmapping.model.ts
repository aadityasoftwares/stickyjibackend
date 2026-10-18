import mongoose, { Schema, type Model } from "mongoose";
import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { BillingEnvironment, BillingProviderName, GatewayPlanMappingStatus } from "../constants/billing.enums.js";
import type { IBillingPlanMappingDocument } from "../interfaces/billing.interface.js";

const BillingPlanMappingSchema = new Schema<IBillingPlanMappingDocument>({
    planPriceId: { type: Schema.Types.ObjectId, ref: "PlanPrice", required: true },
    provider: { type: String, default: BillingProviderName.RAZORPAY, required: true },
    providerPlanId: { type: String, required: true, trim: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    billingInterval: { type: String, enum: Object.values(BillingInterval), required: true },
    environment: {
        type: String,
        enum: Object.values(BillingEnvironment),
        default: BillingEnvironment.TEST,
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(GatewayPlanMappingStatus),
        default: GatewayPlanMappingStatus.ACTIVE,
        required: true,
    },
}, { timestamps: true, versionKey: false });

BillingPlanMappingSchema.index(
    { planPriceId: 1, provider: 1, environment: 1 },
    { unique: true, name: "uniq_plan_price_provider_env" },
);

BillingPlanMappingSchema.index(
    { providerPlanId: 1, provider: 1, environment: 1 },
    { unique: true, name: "uniq_provider_plan_env" },
);

export const BillingPlanMappingModel: Model<IBillingPlanMappingDocument> =
    mongoose.model<IBillingPlanMappingDocument>("BillingPlanMapping", BillingPlanMappingSchema);
