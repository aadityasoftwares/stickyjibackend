import type { Document, Types } from "mongoose";
import type { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import type { AuditLogAction, AuditLogActorType } from "../../auditlog/constants/auditLog.enums.js";
import type { SubscriptionChangeStatus, UserSubscriptionStatus } from "../constants/usersubscription.enums.js";

export type { UserSubscriptionStatus } from "../constants/usersubscription.enums.js";

export interface ISubscriptionPlanChange {
    requestId: Types.ObjectId;
    planId: Types.ObjectId;
    planPriceId: Types.ObjectId | null;
    billingInterval: BillingInterval | null;
    status: SubscriptionChangeStatus;
    requestedAt: Date;
    effectiveAt: Date | null;
}

export interface ISubscriptionAuditEvent {
    _id: Types.ObjectId;
    actorId: Types.ObjectId | null;
    actorType: AuditLogActorType;
    action: AuditLogAction;
    reason: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    occurredAt: Date;
    requestId: string | null;
}

export interface IUserSubscription {
    user: Types.ObjectId;
    plan: Types.ObjectId;
    planPriceId: Types.ObjectId | null;
    billingInterval: BillingInterval | null;
    status: UserSubscriptionStatus;
    startDate: Date;
    endDate: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    cancellationEffectiveAt: Date | null;
    cancellationReason: string | null;
    autoRenew: boolean;
    // Restore the user's previous preference when undoing a cancellation.
    autoRenewBeforeCancellation: boolean | null;
    pendingChange: ISubscriptionPlanChange | null;
    paymentId?: string;
    paymentProvider: string | null;
    providerSubscriptionId: string | null;
    providerCustomerId: string | null;
    isActive: boolean;
    revision: number;
    auditOutbox: ISubscriptionAuditEvent[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUserSubscriptionDocument extends IUserSubscription, Document {}
export type UserSubscriptionRecord = IUserSubscription & { _id: Types.ObjectId };
export type UserSubscriptionUpdate = Partial<Pick<IUserSubscription,
    "plan" | "planPriceId" | "billingInterval" | "startDate" | "endDate" |
    "currentPeriodStart" | "currentPeriodEnd" | "status" | "isActive" |
    "autoRenew" | "autoRenewBeforeCancellation" | "pendingChange" |
    "cancelAtPeriodEnd" | "canceledAt" | "cancellationEffectiveAt" | "cancellationReason" |
    "paymentId" | "paymentProvider" | "providerSubscriptionId" | "providerCustomerId"
>>;

export interface IVerifiedBillingEvent {
    user: Types.ObjectId | string;
    plan: Types.ObjectId | string;
    planPriceId?: Types.ObjectId | string | null;
    billingInterval?: BillingInterval | null;
    status: UserSubscriptionStatus;
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    autoRenew?: boolean;
    cancelAtPeriodEnd?: boolean;
    canceledAt?: Date | null;
    cancellationEffectiveAt?: Date | null;
    cancellationReason?: string | null;
    pendingChange?: ISubscriptionPlanChange | null;
    paymentId?: string;
    paymentProvider?: string;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    action?: AuditLogAction;
    reason?: string;
}

export interface IChangeSubscriptionPlan {
    plan: string;
    planPriceId?: string;
    billingInterval?: BillingInterval;
}

export interface ISubscriptionReconciliationResult {
    scanned: number;
    updated: number;
    conflicts: number;
    failed: string[];
    nextCursor: string | null;
}
