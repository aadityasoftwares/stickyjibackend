import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { PaymentStatus } from "../constants/subscriptionpayment.enums.js";
import { SubscriptionPaymentMessages } from "../constants/subscriptionpayment.messages.js";
import type {
    IRecordCapturedPaymentInput,
    IRecordPaymentAttemptInput,
    IRecordPaymentFailureInput,
    IRecordRefundInput,
    SubscriptionPaymentRecord,
} from "../interfaces/subscriptionpayment.interface.js";
import { SubscriptionPaymentRepository } from "../repositories/subscriptionpayment.repository.js";

function toObjectId(val: any): Types.ObjectId {
    if (val && typeof val === "object" && "_id" in val) {
        return new Types.ObjectId(val._id.toString());
    }
    return new Types.ObjectId(val.toString());
}

function toNullableObjectId(val: any): Types.ObjectId | null {
    if (!val) return null;
    if (typeof val === "object" && "_id" in val) {
        return new Types.ObjectId(val._id.toString());
    }
    return new Types.ObjectId(val.toString());
}

export class SubscriptionPaymentService {
    private readonly repository: SubscriptionPaymentRepository;

    constructor() {
        this.repository = new SubscriptionPaymentRepository();
    }

    async recordPaymentAttempt(input: IRecordPaymentAttemptInput): Promise<SubscriptionPaymentRecord> {
        if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
            throw new AppError(SubscriptionPaymentMessages.INVALID_AMOUNT, 400);
        }

        return this.repository.create({
            user: toObjectId(input.user),
            subscriptionId: toNullableObjectId(input.subscriptionId),
            planId: toObjectId(input.planId),
            planPriceId: toNullableObjectId(input.planPriceId),
            billingInterval: input.billingInterval,
            provider: input.provider,
            providerSubscriptionId: input.providerSubscriptionId ?? null,
            providerOrderId: input.providerOrderId ?? null,
            amountMinor: input.amountMinor,
            currency: input.currency.toUpperCase(),
            status: PaymentStatus.INITIATED,
            metadata: input.metadata ?? null,
        });
    }

    async recordCapturedPayment(input: IRecordCapturedPaymentInput): Promise<SubscriptionPaymentRecord> {
        if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
            throw new AppError(SubscriptionPaymentMessages.INVALID_AMOUNT, 400);
        }

        const existing = await this.repository.findByProviderPaymentId(
            input.provider,
            input.providerPaymentId,
        );

        if (existing) {
            if (existing.status === PaymentStatus.CAPTURED) {
                return existing;
            }
            const updated = await this.repository.updateStatus(existing._id, PaymentStatus.CAPTURED, {
                capturedAt: input.capturedAt ?? new Date(),
                billingPeriodStart: input.billingPeriodStart ?? existing.billingPeriodStart,
                billingPeriodEnd: input.billingPeriodEnd ?? existing.billingPeriodEnd,
                providerSignature: input.providerSignature ?? existing.providerSignature,
                subscriptionId: toNullableObjectId(input.subscriptionId) ?? existing.subscriptionId,
                metadata: { ...(existing.metadata ?? {}), ...(input.metadata ?? {}) },
            });
            return updated ?? existing;
        }

        return this.repository.upsertCapturedPayment(
            { provider: input.provider, providerPaymentId: input.providerPaymentId },
            {
                user: toObjectId(input.user),
                subscriptionId: toNullableObjectId(input.subscriptionId),
                planId: toObjectId(input.planId),
                planPriceId: toNullableObjectId(input.planPriceId),
                billingInterval: input.billingInterval,
                provider: input.provider,
                providerPaymentId: input.providerPaymentId,
                providerSubscriptionId: input.providerSubscriptionId ?? null,
                providerOrderId: input.providerOrderId ?? null,
                providerSignature: input.providerSignature ?? null,
                amountMinor: input.amountMinor,
                currency: input.currency.toUpperCase(),
                billingPeriodStart: input.billingPeriodStart ?? null,
                billingPeriodEnd: input.billingPeriodEnd ?? null,
                capturedAt: input.capturedAt ?? new Date(),
                metadata: input.metadata ?? null,
            },
        );
    }

    async recordPaymentFailure(input: IRecordPaymentFailureInput): Promise<SubscriptionPaymentRecord> {
        return this.repository.create({
            user: toObjectId(input.user),
            subscriptionId: toNullableObjectId(input.subscriptionId),
            planId: toObjectId(input.planId),
            planPriceId: toNullableObjectId(input.planPriceId),
            billingInterval: input.billingInterval,
            provider: input.provider,
            providerPaymentId: input.providerPaymentId ?? null,
            providerSubscriptionId: input.providerSubscriptionId ?? null,
            amountMinor: input.amountMinor,
            currency: input.currency.toUpperCase(),
            status: PaymentStatus.FAILED,
            failedAt: input.failedAt ?? new Date(),
            errorCode: input.errorCode ?? null,
            errorMessage: input.errorMessage ?? null,
            metadata: input.metadata ?? null,
        });
    }

    async recordRefund(input: IRecordRefundInput): Promise<SubscriptionPaymentRecord | null> {
        const payment = await this.repository.findByProviderPaymentId(
            input.provider,
            input.providerPaymentId,
        );

        if (!payment) {
            return null;
        }

        return this.repository.updateStatus(payment._id, PaymentStatus.REFUNDED, {
            refundedAt: input.refundedAt ?? new Date(),
            metadata: {
                ...(payment.metadata ?? {}),
                refundId: input.refundId,
                refundAmountMinor: input.refundAmountMinor,
                refundReason: input.reason,
            },
        });
    }

    async findByProviderPaymentId(
        provider: string,
        providerPaymentId: string,
    ): Promise<SubscriptionPaymentRecord | null> {
        return this.repository.findByProviderPaymentId(provider, providerPaymentId);
    }

    async listUserPayments(userId: string, page = 1, limit = 20) {
        return this.repository.listByUser(userId, page, limit);
    }
}
