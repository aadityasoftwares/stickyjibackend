import mongoose, { Schema, type Model } from "mongoose";
import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { AuditLogAction, AuditLogActorType } from "../../auditlog/constants/auditLog.enums.js";
import { SubscriptionChangeStatus, UserSubscriptionStatus } from "../constants/usersubscription.enums.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";
import type { IUserSubscriptionDocument, ISubscriptionAuditEvent, ISubscriptionPlanChange } from "../interfaces/usersubscription.interface.js";

const PlanChangeSchema = new Schema<ISubscriptionPlanChange>({
    requestId: { type: Schema.Types.ObjectId, required: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    planPriceId: { type: Schema.Types.ObjectId, ref: "PlanPrice", default: null },
    billingInterval: { type: String, enum: Object.values(BillingInterval), default: null },
    status: { type: String, enum: Object.values(SubscriptionChangeStatus), required: true },
    requestedAt: { type: Date, required: true },
    effectiveAt: { type: Date, default: null },
}, { _id: false });

const AuditEventSchema = new Schema<ISubscriptionAuditEvent>({
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorType: { type: String, enum: Object.values(AuditLogActorType), required: true },
    action: { type: String, enum: Object.values(AuditLogAction), required: true },
    reason: { type: String, required: true, maxlength: USER_SUBSCRIPTION_CONSTANTS.REASON_MAX_LENGTH },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, required: true },
    occurredAt: { type: Date, required: true },
    requestId: { type: String, default: null },
});

const UserSubscriptionSchema = new Schema<IUserSubscriptionDocument>({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    planPriceId: { type: Schema.Types.ObjectId, ref: "PlanPrice", default: null },
    billingInterval: { type: String, enum: Object.values(BillingInterval), default: null },
    status: {
        type: String,
        enum: Object.values(UserSubscriptionStatus),
        default: USER_SUBSCRIPTION_CONSTANTS.DEFAULT_STATUS,
        required: true,
    },
    startDate: { type: Date, required: true },
    // Null explicitly denotes a non-expiring Free subscription.
    endDate: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    autoRenew: { type: Boolean, default: USER_SUBSCRIPTION_CONSTANTS.DEFAULT_AUTO_RENEW },
    autoRenewBeforeCancellation: { type: Boolean, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },
    cancellationEffectiveAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: USER_SUBSCRIPTION_CONSTANTS.REASON_MAX_LENGTH, default: null },
    pendingChange: { type: PlanChangeSchema, default: null },
    paymentId: { type: String, trim: true, select: false },
    paymentProvider: { type: String, trim: true, default: null, select: false },
    providerSubscriptionId: { type: String, trim: true, default: null, select: false },
    providerCustomerId: { type: String, trim: true, default: null, select: false },
    isActive: { type: Boolean, default: USER_SUBSCRIPTION_CONSTANTS.DEFAULT_ACTIVE, required: true },
    revision: { type: Number, default: 0, required: true, min: 0 },
    auditOutbox: { type: [AuditEventSchema], default: [], select: false },
}, { timestamps: true, versionKey: false });

UserSubscriptionSchema.index({ user: 1, isActive: 1 }, {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: "one_effective_subscription_per_user",
});
UserSubscriptionSchema.index({ user: 1, createdAt: -1, _id: -1 });
UserSubscriptionSchema.index({ user: 1, status: 1, createdAt: -1 });
UserSubscriptionSchema.index({ isActive: 1, endDate: 1, _id: 1 });
UserSubscriptionSchema.index({ isActive: 1, currentPeriodEnd: 1, _id: 1 });
UserSubscriptionSchema.index({ isActive: 1, cancelAtPeriodEnd: 1, cancellationEffectiveAt: 1, _id: 1 });
UserSubscriptionSchema.index({ "auditOutbox.occurredAt": 1 });
UserSubscriptionSchema.index({ paymentProvider: 1, providerSubscriptionId: 1 }, {
    unique: true,
    partialFilterExpression: {
        paymentProvider: { $type: "string", $gt: "" },
        providerSubscriptionId: { $type: "string", $gt: "" },
    },
    name: "uniq_subscription_provider_reference",
});

export const UserSubscriptionModel: Model<IUserSubscriptionDocument> =
    mongoose.model<IUserSubscriptionDocument>("UserSubscription", UserSubscriptionSchema);
