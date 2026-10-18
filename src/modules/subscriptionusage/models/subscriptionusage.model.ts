import mongoose, { Model, Schema } from "mongoose";
import type { ISubscriptionUsageDocument } from "../interfaces/subscriptionusage.interface.js";
import { BillingScopeType } from "../constants/subscriptionusage.enums.js";
import { SUBSCRIPTION_USAGE_CONSTANTS } from "../constants/subscriptionusage.constants.js";

const SubscriptionUsageSchema = new Schema<ISubscriptionUsageDocument>(
    {
        scopeType: {
            type: String,
            enum: Object.values(BillingScopeType),
            required: true,
            default: BillingScopeType.USER,
        },
        scopeId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
        workspacesUsed: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        activeStickyNotesUsed: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        storageBytesUsed: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        usersUsed: {
            type: Number,
            required: true,
            min: 1,
            default: SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_USERS_COUNT,
        },
        lastCalculatedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        revision: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
    },
    {
        timestamps: true,
        collection: SUBSCRIPTION_USAGE_CONSTANTS.COLLECTION_NAME,
        versionKey: false,
    },
);

SubscriptionUsageSchema.index(
    { scopeType: 1, scopeId: 1 },
    { unique: true, name: "uniq_subscription_usage_scope" },
);
SubscriptionUsageSchema.index({ updatedAt: -1 }, { name: "subscription_usage_updated_at" });
SubscriptionUsageSchema.index({ workspacesUsed: -1 }, { name: "subscription_usage_workspaces_used" });
SubscriptionUsageSchema.index({ activeStickyNotesUsed: -1 }, { name: "subscription_usage_notes_used" });
SubscriptionUsageSchema.index({ storageBytesUsed: -1 }, { name: "subscription_usage_storage_used" });

export const SubscriptionUsageModel: Model<ISubscriptionUsageDocument> =
    (mongoose.models.SubscriptionUsage as Model<ISubscriptionUsageDocument> | undefined) ??
    mongoose.model<ISubscriptionUsageDocument>("SubscriptionUsage", SubscriptionUsageSchema);
