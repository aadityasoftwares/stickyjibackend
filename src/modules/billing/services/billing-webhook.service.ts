import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { PlanPriceModel } from "../../planprice/models/planPrice.model.js";
import { SubscriptionPaymentService } from "../../subscriptionpayment/services/subscriptionpayment.service.js";
import { UserSubscriptionStatus } from "../../usersubscription/constants/usersubscription.enums.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";
import {
    BillingEventProcessingStatus,
    BillingProviderName,
    CheckoutIntentStatus,
} from "../constants/billing.enums.js";
import { BillingMessages } from "../constants/billing.messages.js";
import type { IBillingProvider } from "../interfaces/billing-provider.interface.js";
import { BillingRepository } from "../repositories/billing.repository.js";

export class BillingWebhookService {
    private readonly repository: BillingRepository;
    private readonly provider: IBillingProvider;
    private readonly paymentService: SubscriptionPaymentService;
    private readonly subscriptionService: UserSubscriptionService;

    constructor(
        provider: IBillingProvider,
        repository = new BillingRepository(),
        paymentService = new SubscriptionPaymentService(),
        subscriptionService = new UserSubscriptionService(),
    ) {
        this.provider = provider;
        this.repository = repository;
        this.paymentService = paymentService;
        this.subscriptionService = subscriptionService;
    }

    async processWebhook(rawBody: Buffer | string, signature: string, headers: Record<string, any> = {}): Promise<{
        success: boolean;
        duplicate?: boolean;
        event: string;
    }> {
        const isValid = this.provider.verifyWebhookSignature(rawBody, signature);
        if (!isValid) {
            throw new AppError(BillingMessages.SIGNATURE_INVALID, 400, "INVALID_SIGNATURE");
        }

        const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : JSON.parse(rawBody.toString("utf8"));
        const eventId = (headers["x-razorpay-event-id"] as string) || payload.event_id || payload.id || "";
        const eventType = payload.event as string;

        if (!eventId || !eventType) {
            throw new AppError("Malformed webhook payload", 400, "MALFORMED_WEBHOOK");
        }

        const existing = await this.repository.findEventByProviderAndId(BillingProviderName.RAZORPAY, eventId);
        if (existing) {
            if (existing.processingStatus === BillingEventProcessingStatus.PROCESSED) {
                return { success: true, duplicate: true, event: eventType };
            }
        } else {
            await this.repository.recordWebhookEvent({
                provider: BillingProviderName.RAZORPAY,
                eventId,
                eventType,
                providerSubscriptionId: payload.payload?.subscription?.entity?.id ?? null,
                providerPaymentId: payload.payload?.payment?.entity?.id ?? null,
                payload,
                processingStatus: BillingEventProcessingStatus.PROCESSING,
                attempts: 1,
                receivedAt: new Date(),
            });
        }

        try {
            await this.routeEvent(eventType, payload);

            await this.repository.updateEventStatus(
                BillingProviderName.RAZORPAY,
                eventId,
                BillingEventProcessingStatus.PROCESSED,
                { processedAt: new Date() },
            );

            return { success: true, event: eventType };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            await this.repository.updateEventStatus(
                BillingProviderName.RAZORPAY,
                eventId,
                BillingEventProcessingStatus.FAILED,
                {
                    lastErrorCode: (error as any)?.code || "PROCESSING_ERROR",
                    lastErrorMessage: errorMessage,
                    nextRetryAt: new Date(Date.now() + 60000),
                    attemptsIncrement: 1,
                },
            );
            throw error;
        }
    }

    private async routeEvent(eventType: string, payload: any): Promise<void> {
        const subEntity = payload.payload?.subscription?.entity;
        const paymentEntity = payload.payload?.payment?.entity;

        switch (eventType) {
            case "subscription.activated":
            case "subscription.authenticated":
                await this.handleSubscriptionActivated(subEntity, paymentEntity);
                break;

            case "subscription.charged":
                await this.handleSubscriptionCharged(subEntity, paymentEntity);
                break;

            case "subscription.pending":
                await this.handleSubscriptionPending(subEntity);
                break;

            case "subscription.halted":
                await this.handleSubscriptionHalted(subEntity);
                break;

            case "subscription.cancelled":
                await this.handleSubscriptionCancelled(subEntity);
                break;

            case "subscription.completed":
                await this.handleSubscriptionCompleted(subEntity);
                break;

            case "payment.failed":
                await this.handlePaymentFailed(paymentEntity, subEntity);
                break;

            case "refund.processed":
                await this.handleRefundProcessed(payload.payload?.refund?.entity, paymentEntity);
                break;

            default:
                // Safely ignored
                break;
        }
    }

    private async handleSubscriptionActivated(subEntity: any, paymentEntity?: any): Promise<void> {
        if (!subEntity?.id) return;
        const providerSubscriptionId = subEntity.id as string;

        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        if (!intent) {
            return;
        }

        const planPrice = await PlanPriceModel.findById(intent.planPriceId).lean().exec();
        if (!planPrice) return;

        const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : new Date();
        const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null;

        let paymentId: string | undefined;
        if (paymentEntity?.id) {
            paymentId = paymentEntity.id;
            await this.paymentService.recordCapturedPayment({
                user: intent.user,
                planId: intent.planId,
                planPriceId: intent.planPriceId,
                billingInterval: intent.billingInterval,
                provider: BillingProviderName.RAZORPAY,
                providerPaymentId: paymentEntity.id,
                providerSubscriptionId,
                amountMinor: paymentEntity.amount,
                currency: paymentEntity.currency,
                billingPeriodStart: currentStart,
                billingPeriodEnd: currentEnd,
                capturedAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
            });
        }

        await this.subscriptionService.applyVerifiedBillingEvent({
            user: intent.user,
            plan: intent.planId,
            planPriceId: intent.planPriceId,
            billingInterval: intent.billingInterval,
            status: UserSubscriptionStatus.ACTIVE,
            isActive: true,
            startDate: currentStart,
            currentPeriodStart: currentStart,
            currentPeriodEnd: currentEnd,
            endDate: currentEnd,
            autoRenew: true,
            cancelAtPeriodEnd: false,
            paymentId,
            paymentProvider: BillingProviderName.RAZORPAY,
            providerSubscriptionId,
            action: AuditLogAction.UPDATE,
            reason: "Subscription activated via Razorpay webhook",
        });

        await this.repository.updateCheckoutIntentStatus(intent.checkoutIntentId, CheckoutIntentStatus.COMPLETED);
    }

    private async handleSubscriptionCharged(subEntity: any, paymentEntity: any): Promise<void> {
        if (!subEntity?.id || !paymentEntity?.id) return;

        const providerSubscriptionId = subEntity.id as string;
        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : new Date();
        const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null;

        if (intent) {
            await this.paymentService.recordCapturedPayment({
                user: intent.user,
                planId: intent.planId,
                planPriceId: intent.planPriceId,
                billingInterval: intent.billingInterval,
                provider: BillingProviderName.RAZORPAY,
                providerPaymentId: paymentEntity.id,
                providerSubscriptionId,
                amountMinor: paymentEntity.amount,
                currency: paymentEntity.currency,
                billingPeriodStart: currentStart,
                billingPeriodEnd: currentEnd,
                capturedAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
            });

            await this.subscriptionService.applyVerifiedBillingEvent({
                user: intent.user,
                plan: intent.planId,
                planPriceId: intent.planPriceId,
                billingInterval: intent.billingInterval,
                status: UserSubscriptionStatus.ACTIVE,
                isActive: true,
                currentPeriodStart: currentStart,
                currentPeriodEnd: currentEnd,
                endDate: currentEnd,
                autoRenew: true,
                paymentId: paymentEntity.id,
                paymentProvider: BillingProviderName.RAZORPAY,
                providerSubscriptionId,
                action: AuditLogAction.UPDATE,
                reason: "Subscription renewed via Razorpay charged event",
            });

            await this.repository.updateCheckoutIntentStatus(intent.checkoutIntentId, CheckoutIntentStatus.COMPLETED);
        }
    }

    private async handleSubscriptionPending(subEntity: any): Promise<void> {
        if (!subEntity?.id) return;
        const providerSubscriptionId = subEntity.id as string;
        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        if (intent) {
            await this.subscriptionService.applyVerifiedBillingEvent({
                user: intent.user,
                plan: intent.planId,
                status: UserSubscriptionStatus.PAST_DUE,
                providerSubscriptionId,
                paymentProvider: BillingProviderName.RAZORPAY,
                action: AuditLogAction.UPDATE,
                reason: "Subscription marked PAST_DUE via Razorpay pending event",
            });
        }
    }

    private async handleSubscriptionHalted(subEntity: any): Promise<void> {
        if (!subEntity?.id) return;
        const providerSubscriptionId = subEntity.id as string;
        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        if (intent) {
            await this.subscriptionService.applyVerifiedBillingEvent({
                user: intent.user,
                plan: intent.planId,
                status: UserSubscriptionStatus.PAST_DUE,
                autoRenew: false,
                providerSubscriptionId,
                paymentProvider: BillingProviderName.RAZORPAY,
                action: AuditLogAction.UPDATE,
                reason: "Subscription halted by Razorpay",
            });
        }
    }

    private async handleSubscriptionCancelled(subEntity: any): Promise<void> {
        if (!subEntity?.id) return;
        const providerSubscriptionId = subEntity.id as string;
        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        if (intent) {
            const endedAt = subEntity.ended_at ? new Date(subEntity.ended_at * 1000) : null;
            const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null;
            const now = new Date();

            const isFuture = (endedAt && endedAt > now) || (currentEnd && currentEnd > now);

            if (isFuture) {
                // Scheduled at period end
                await this.subscriptionService.applyVerifiedBillingEvent({
                    user: intent.user,
                    plan: intent.planId,
                    status: UserSubscriptionStatus.ACTIVE,
                    cancelAtPeriodEnd: true,
                    cancellationEffectiveAt: endedAt ?? currentEnd,
                    cancellationReason: "Cancelled via Razorpay subscription.cancelled event",
                    autoRenew: false,
                    providerSubscriptionId,
                    paymentProvider: BillingProviderName.RAZORPAY,
                    action: AuditLogAction.UPDATE,
                    reason: "Subscription scheduled for cancellation at period end",
                });
            } else {
                // Immediate cancellation
                await this.subscriptionService.applyVerifiedBillingEvent({
                    user: intent.user,
                    plan: intent.planId,
                    status: UserSubscriptionStatus.CANCELED,
                    isActive: false,
                    canceledAt: now,
                    cancellationEffectiveAt: now,
                    cancellationReason: "Cancelled immediately via Razorpay",
                    autoRenew: false,
                    providerSubscriptionId,
                    paymentProvider: BillingProviderName.RAZORPAY,
                    action: AuditLogAction.UPDATE,
                    reason: "Subscription cancelled immediately via Razorpay",
                });
            }
        }
    }

    private async handleSubscriptionCompleted(subEntity: any): Promise<void> {
        if (!subEntity?.id) return;
        const providerSubscriptionId = subEntity.id as string;
        const intent = await this.repository.findCheckoutIntentByProviderSubscriptionId(
            BillingProviderName.RAZORPAY,
            providerSubscriptionId,
        );

        if (intent) {
            await this.subscriptionService.applyVerifiedBillingEvent({
                user: intent.user,
                plan: intent.planId,
                status: UserSubscriptionStatus.EXPIRED,
                isActive: false,
                autoRenew: false,
                providerSubscriptionId,
                paymentProvider: BillingProviderName.RAZORPAY,
                action: AuditLogAction.UPDATE,
                reason: "Subscription completed all scheduled billing cycles",
            });
        }
    }

    private async handlePaymentFailed(paymentEntity: any, subEntity?: any): Promise<void> {
        if (!paymentEntity) return;

        const providerSubscriptionId = subEntity?.id || paymentEntity.notes?.subscriptionId;
        const intent = providerSubscriptionId
            ? await this.repository.findCheckoutIntentByProviderSubscriptionId(BillingProviderName.RAZORPAY, providerSubscriptionId)
            : null;

        if (intent) {
            await this.paymentService.recordPaymentFailure({
                user: intent.user,
                planId: intent.planId,
                planPriceId: intent.planPriceId,
                billingInterval: intent.billingInterval,
                provider: BillingProviderName.RAZORPAY,
                providerPaymentId: paymentEntity.id,
                providerSubscriptionId,
                amountMinor: paymentEntity.amount ?? intent.amountMinor,
                currency: paymentEntity.currency ?? intent.currency,
                errorCode: paymentEntity.error_code,
                errorMessage: paymentEntity.error_description,
                failedAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date(),
            });
        }
    }

    private async handleRefundProcessed(refundEntity: any, paymentEntity: any): Promise<void> {
        if (!refundEntity || !paymentEntity) return;
        await this.paymentService.recordRefund({
            provider: BillingProviderName.RAZORPAY,
            providerPaymentId: paymentEntity.id,
            refundId: refundEntity.id,
            refundAmountMinor: refundEntity.amount,
            refundedAt: refundEntity.created_at ? new Date(refundEntity.created_at * 1000) : new Date(),
            reason: refundEntity.notes?.reason ?? "Refund processed by merchant",
        });
    }
}
