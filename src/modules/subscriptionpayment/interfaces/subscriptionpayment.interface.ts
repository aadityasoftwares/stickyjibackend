import type { Document, Types } from "mongoose";
import type { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import type { PaymentProvider, PaymentStatus } from "../constants/subscriptionpayment.enums.js";

export interface ISubscriptionPayment {
    user: Types.ObjectId;
    subscriptionId?: Types.ObjectId | null;
    planId: Types.ObjectId;
    planPriceId?: Types.ObjectId | null;
    billingInterval: BillingInterval;
    provider: PaymentProvider | string;
    providerPaymentId?: string | null;
    providerSubscriptionId?: string | null;
    providerOrderId?: string | null;
    providerSignature?: string | null;
    amountMinor: number;
    currency: string;
    status: PaymentStatus;
    billingPeriodStart?: Date | null;
    billingPeriodEnd?: Date | null;
    capturedAt?: Date | null;
    failedAt?: Date | null;
    refundedAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISubscriptionPaymentDocument extends ISubscriptionPayment, Document {}
export type SubscriptionPaymentRecord = ISubscriptionPayment & { _id: Types.ObjectId };

export interface IRecordPaymentAttemptInput {
    user: Types.ObjectId | string;
    subscriptionId?: Types.ObjectId | string | null;
    planId: Types.ObjectId | string;
    planPriceId?: Types.ObjectId | string | null;
    billingInterval: BillingInterval;
    provider: PaymentProvider | string;
    providerSubscriptionId?: string | null;
    providerOrderId?: string | null;
    amountMinor: number;
    currency: string;
    metadata?: Record<string, unknown>;
}

export interface IRecordCapturedPaymentInput {
    user: Types.ObjectId | string;
    subscriptionId?: Types.ObjectId | string | null;
    planId: Types.ObjectId | string;
    planPriceId?: Types.ObjectId | string | null;
    billingInterval: BillingInterval;
    provider: PaymentProvider | string;
    providerPaymentId: string;
    providerSubscriptionId?: string | null;
    providerOrderId?: string | null;
    providerSignature?: string | null;
    amountMinor: number;
    currency: string;
    billingPeriodStart?: Date | null;
    billingPeriodEnd?: Date | null;
    capturedAt?: Date;
    metadata?: Record<string, unknown>;
}

export interface IRecordPaymentFailureInput {
    user: Types.ObjectId | string;
    subscriptionId?: Types.ObjectId | string | null;
    planId: Types.ObjectId | string;
    planPriceId?: Types.ObjectId | string | null;
    billingInterval: BillingInterval;
    provider: PaymentProvider | string;
    providerPaymentId?: string | null;
    providerSubscriptionId?: string | null;
    amountMinor: number;
    currency: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    failedAt?: Date;
    metadata?: Record<string, unknown>;
}

export interface IRecordRefundInput {
    provider: PaymentProvider | string;
    providerPaymentId: string;
    refundId?: string;
    refundAmountMinor?: number;
    refundedAt?: Date;
    reason?: string;
}
