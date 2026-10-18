import type { Document, Types } from "mongoose";
import type { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import type {
    BillingEnvironment,
    BillingEventProcessingStatus,
    BillingProviderName,
    CheckoutIntentStatus,
    GatewayPlanMappingStatus,
} from "../constants/billing.enums.js";

export interface IBillingPlanMapping {
    planPriceId: Types.ObjectId;
    provider: BillingProviderName | string;
    providerPlanId: string;
    amountMinor: number;
    currency: string;
    billingInterval: BillingInterval;
    environment: BillingEnvironment | string;
    status: GatewayPlanMappingStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBillingPlanMappingDocument extends IBillingPlanMapping, Document {}
export type BillingPlanMappingRecord = IBillingPlanMapping & { _id: Types.ObjectId };

export interface ICheckoutIntent {
    checkoutIntentId: string;
    user: Types.ObjectId;
    planId: Types.ObjectId;
    planPriceId: Types.ObjectId;
    billingInterval: BillingInterval;
    provider: BillingProviderName | string;
    providerSubscriptionId: string;
    amountMinor: number;
    currency: string;
    status: CheckoutIntentStatus;
    expiresAt: Date;
    metadata?: Record<string, unknown> | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICheckoutIntentDocument extends ICheckoutIntent, Document {}
export type CheckoutIntentRecord = ICheckoutIntent & { _id: Types.ObjectId };

export interface IBillingEvent {
    provider: BillingProviderName | string;
    eventId: string;
    eventType: string;
    providerSubscriptionId?: string | null;
    providerPaymentId?: string | null;
    payload: Record<string, unknown>;
    processingStatus: BillingEventProcessingStatus;
    attempts: number;
    receivedAt: Date;
    processedAt?: Date | null;
    nextRetryAt?: Date | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBillingEventDocument extends IBillingEvent, Document {}
export type BillingEventRecord = IBillingEvent & { _id: Types.ObjectId };

export interface ICheckoutResponse {
    provider: string;
    keyId: string;
    subscriptionId: string;
    checkoutIntentId: string;
    plan: {
        code: string;
        name: string;
        billingInterval: BillingInterval;
        currency: string;
        amountMinor: number;
    };
}

export interface IVerifyCheckoutInput {
    checkoutIntentId: string;
    razorpayPaymentId: string;
    razorpaySubscriptionId: string;
    razorpaySignature: string;
}

export interface IChangeBillingPlanInput {
    targetPlanPriceId: string;
}

export interface ICancelBillingInput {
    reason?: string;
    immediate?: boolean;
}
