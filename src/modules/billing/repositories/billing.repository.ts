import { Types } from "mongoose";
import { BillingEventModel } from "../models/billingevent.model.js";
import { BillingPlanMappingModel } from "../models/billingplanmapping.model.js";
import { CheckoutIntentModel } from "../models/checkoutintent.model.js";
import {
    BillingEventProcessingStatus,
    CheckoutIntentStatus,
    GatewayPlanMappingStatus,
} from "../constants/billing.enums.js";
import type {
    BillingEventRecord,
    BillingPlanMappingRecord,
    CheckoutIntentRecord,
    IBillingEvent,
    IBillingPlanMapping,
    ICheckoutIntent,
} from "../interfaces/billing.interface.js";

export class BillingRepository {
    // ---------------- Plan Mapping ---------------- //

    async findPlanMapping(
        planPriceId: Types.ObjectId | string,
        provider: string,
        environment: string,
    ): Promise<BillingPlanMappingRecord | null> {
        return BillingPlanMappingModel.findOne({
            planPriceId: new Types.ObjectId(planPriceId.toString()),
            provider,
            environment,
            status: GatewayPlanMappingStatus.ACTIVE,
        }).lean<BillingPlanMappingRecord>().exec();
    }

    async findPlanMappingByProviderPlanId(
        providerPlanId: string,
        provider: string,
        environment: string,
    ): Promise<BillingPlanMappingRecord | null> {
        return BillingPlanMappingModel.findOne({
            providerPlanId,
            provider,
            environment,
        }).lean<BillingPlanMappingRecord>().exec();
    }

    async createPlanMapping(data: Partial<IBillingPlanMapping>): Promise<BillingPlanMappingRecord> {
        const doc = await BillingPlanMappingModel.create(data);
        return doc.toObject() as BillingPlanMappingRecord;
    }

    // ---------------- Checkout Intents ---------------- //

    async createCheckoutIntent(data: Partial<ICheckoutIntent>): Promise<CheckoutIntentRecord> {
        const doc = await CheckoutIntentModel.create(data);
        return doc.toObject() as CheckoutIntentRecord;
    }

    async findCheckoutIntentById(checkoutIntentId: string): Promise<CheckoutIntentRecord | null> {
        return CheckoutIntentModel.findOne({ checkoutIntentId })
            .populate("planId", "name code type")
            .populate("planPriceId", "amountMinor currencyId billingInterval")
            .lean<CheckoutIntentRecord>()
            .exec();
    }

    async findActivePendingIntentByUserAndPrice(
        userId: Types.ObjectId | string,
        planPriceId: Types.ObjectId | string,
    ): Promise<CheckoutIntentRecord | null> {
        return CheckoutIntentModel.findOne({
            user: new Types.ObjectId(userId.toString()),
            planPriceId: new Types.ObjectId(planPriceId.toString()),
            status: CheckoutIntentStatus.PENDING,
            expiresAt: { $gt: new Date() },
        })
            .sort({ createdAt: -1 })
            .lean<CheckoutIntentRecord>()
            .exec();
    }

    async findCheckoutIntentByProviderSubscriptionId(
        provider: string,
        providerSubscriptionId: string,
    ): Promise<CheckoutIntentRecord | null> {
        return CheckoutIntentModel.findOne({ provider, providerSubscriptionId })
            .lean<CheckoutIntentRecord>()
            .exec();
    }

    async updateCheckoutIntentStatus(
        checkoutIntentId: string,
        status: CheckoutIntentStatus,
        metadata?: Record<string, unknown>,
    ): Promise<CheckoutIntentRecord | null> {
        return CheckoutIntentModel.findOneAndUpdate(
            { checkoutIntentId },
            { $set: { status, ...(metadata ? { metadata } : {}) } },
            { new: true },
        ).lean<CheckoutIntentRecord>().exec();
    }

    async findStalePendingIntents(olderThan: Date, limit = 50): Promise<CheckoutIntentRecord[]> {
        return CheckoutIntentModel.find({
            status: CheckoutIntentStatus.PENDING,
            expiresAt: { $lt: olderThan },
        })
            .limit(limit)
            .lean<CheckoutIntentRecord[]>()
            .exec();
    }

    // ---------------- Webhook Events ---------------- //

    async findEventByProviderAndId(
        provider: string,
        eventId: string,
    ): Promise<BillingEventRecord | null> {
        return BillingEventModel.findOne({ provider, eventId })
            .lean<BillingEventRecord>()
            .exec();
    }

    async recordWebhookEvent(data: Partial<IBillingEvent>): Promise<BillingEventRecord> {
        const doc = await BillingEventModel.create(data);
        return doc.toObject() as BillingEventRecord;
    }

    async updateEventStatus(
        provider: string,
        eventId: string,
        processingStatus: BillingEventProcessingStatus,
        extra: {
            processedAt?: Date | null;
            nextRetryAt?: Date | null;
            lastErrorCode?: string | null;
            lastErrorMessage?: string | null;
            attemptsIncrement?: number;
        } = {},
    ): Promise<BillingEventRecord | null> {
        return BillingEventModel.findOneAndUpdate(
            { provider, eventId },
            {
                $set: {
                    processingStatus,
                    processedAt: extra.processedAt,
                    nextRetryAt: extra.nextRetryAt,
                    lastErrorCode: extra.lastErrorCode,
                    lastErrorMessage: extra.lastErrorMessage,
                },
                $inc: { attempts: extra.attemptsIncrement ?? 0 },
            },
            { new: true },
        ).lean<BillingEventRecord>().exec();
    }

    async findRetryableEvents(limit = 50): Promise<BillingEventRecord[]> {
        return BillingEventModel.find({
            processingStatus: BillingEventProcessingStatus.FAILED,
            nextRetryAt: { $lte: new Date() },
            attempts: { $lt: 5 },
        })
            .limit(limit)
            .lean<BillingEventRecord[]>()
            .exec();
    }
}
