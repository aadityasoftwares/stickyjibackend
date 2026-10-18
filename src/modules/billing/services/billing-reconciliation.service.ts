import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { UserSubscriptionStatus } from "../../usersubscription/constants/usersubscription.enums.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";
import {
    BillingEventProcessingStatus,
    BillingProviderName,
    CheckoutIntentStatus,
} from "../constants/billing.enums.js";
import type { IBillingProvider } from "../interfaces/billing-provider.interface.js";
import { BillingRepository } from "../repositories/billing.repository.js";
import { BillingWebhookService } from "./billing-webhook.service.js";

export class BillingReconciliationService {
    private readonly repository: BillingRepository;
    private readonly provider: IBillingProvider;
    private readonly subscriptionService: UserSubscriptionService;
    private readonly webhookService: BillingWebhookService;

    constructor(
        provider: IBillingProvider,
        repository = new BillingRepository(),
        subscriptionService = new UserSubscriptionService(),
        webhookService = new BillingWebhookService(provider, repository, undefined, subscriptionService),
    ) {
        this.provider = provider;
        this.repository = repository;
        this.subscriptionService = subscriptionService;
        this.webhookService = webhookService;
    }

    async reconcile(batchSize = 50): Promise<{
        scannedIntents: number;
        reconciledIntents: number;
        expiredIntents: number;
        retriedWebhooks: number;
        failedWebhooks: number;
    }> {
        const result = {
            scannedIntents: 0,
            reconciledIntents: 0,
            expiredIntents: 0,
            retriedWebhooks: 0,
            failedWebhooks: 0,
        };

        // 1. Reconcile stale pending checkout intents
        const staleIntents = await this.repository.findStalePendingIntents(new Date(), batchSize);
        result.scannedIntents = staleIntents.length;

        for (const intent of staleIntents) {
            try {
                const sub = await this.provider.getSubscription(intent.providerSubscriptionId);
                if (sub.status === "active" || sub.status === "authenticated") {
                    await this.subscriptionService.applyVerifiedBillingEvent({
                        user: intent.user,
                        plan: intent.planId,
                        planPriceId: intent.planPriceId,
                        billingInterval: intent.billingInterval,
                        status: UserSubscriptionStatus.ACTIVE,
                        isActive: true,
                        startDate: sub.currentStart ?? new Date(),
                        currentPeriodStart: sub.currentStart ?? new Date(),
                        currentPeriodEnd: sub.currentEnd,
                        endDate: sub.currentEnd,
                        autoRenew: true,
                        paymentProvider: BillingProviderName.RAZORPAY,
                        providerSubscriptionId: intent.providerSubscriptionId,
                        action: AuditLogAction.UPDATE,
                        reason: "Reconciled from Razorpay subscription status: " + sub.status,
                    });
                    await this.repository.updateCheckoutIntentStatus(intent.checkoutIntentId, CheckoutIntentStatus.COMPLETED);
                    result.reconciledIntents++;
                } else if (["cancelled", "expired", "completed"].includes(sub.status)) {
                    await this.repository.updateCheckoutIntentStatus(intent.checkoutIntentId, CheckoutIntentStatus.EXPIRED);
                    result.expiredIntents++;
                } else {
                    await this.repository.updateCheckoutIntentStatus(intent.checkoutIntentId, CheckoutIntentStatus.EXPIRED);
                    result.expiredIntents++;
                }
            } catch {
                // If remote provider call fails, keep for next cycle
            }
        }

        // 2. Retry failed webhook events
        const retryable = await this.repository.findRetryableEvents(batchSize);
        for (const evt of retryable) {
            try {
                result.retriedWebhooks++;
                const payloadString = JSON.stringify(evt.payload);
                // Directly call the webhook router with payload
                await (this.webhookService as any).routeEvent(evt.eventType, evt.payload);
                await this.repository.updateEventStatus(
                    evt.provider,
                    evt.eventId,
                    BillingEventProcessingStatus.PROCESSED,
                    { processedAt: new Date() },
                );
            } catch (err) {
                result.failedWebhooks++;
                await this.repository.updateEventStatus(
                    evt.provider,
                    evt.eventId,
                    BillingEventProcessingStatus.FAILED,
                    {
                        lastErrorMessage: err instanceof Error ? err.message : "Retry failed",
                        nextRetryAt: new Date(Date.now() + 300000), // backoff 5 minutes
                        attemptsIncrement: 1,
                    },
                );
            }
        }

        return result;
    }
}
