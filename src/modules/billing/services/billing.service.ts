import crypto from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { CurrencyModel } from "../../currency/models/currency.model.js";
import { PlanType, PlanVisibility } from "../../plan/constants/plan.enums.js";
import { PlanModel } from "../../plan/models/plan.model.js";
import { PlanPriceModel } from "../../planprice/models/planPrice.model.js";
import { SubscriptionPaymentService } from "../../subscriptionpayment/services/subscriptionpayment.service.js";
import { UserSubscriptionStatus } from "../../usersubscription/constants/usersubscription.enums.js";
import { UserSubscriptionModel } from "../../usersubscription/models/usersubscription.model.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";
import { getBillingConfig } from "../config/billing.config.js";
import { BILLING_CONSTANTS } from "../constants/billing.constants.js";
import {
    BillingEnvironment,
    BillingProviderName,
    CheckoutIntentStatus,
    GatewayPlanMappingStatus,
} from "../constants/billing.enums.js";
import { BillingMessages } from "../constants/billing.messages.js";
import type { IBillingProvider } from "../interfaces/billing-provider.interface.js";
import type {
    ICancelBillingInput,
    IChangeBillingPlanInput,
    ICheckoutResponse,
    IVerifyCheckoutInput,
} from "../interfaces/billing.interface.js";
import { RazorpayProvider } from "../providers/razorpay.provider.js";
import { BillingRepository } from "../repositories/billing.repository.js";
import type { CancelBillingInput } from "../validations/cancelBilling.validation.js";
import type { ChangePlanBillingInput } from "../validations/changePlanBilling.validation.js";
import type { GetBillingHistoryInput } from "../validations/getBillingHistory.validation.js";
import type { SubscribeBillingInput } from "../validations/subscribeBilling.validation.js";

export class BillingService {
    private readonly repository: BillingRepository;
    private readonly provider: IBillingProvider;
    private readonly paymentService: SubscriptionPaymentService;
    private readonly userSubscriptionService: UserSubscriptionService;

    constructor(
        provider?: IBillingProvider,
        repository = new BillingRepository(),
        paymentService = new SubscriptionPaymentService(),
        userSubscriptionService = new UserSubscriptionService(),
    ) {
        this.provider = provider ?? new RazorpayProvider();
        this.repository = repository;
        this.paymentService = paymentService;
        this.userSubscriptionService = userSubscriptionService;
    }

    async getBillingPlans() {
        const [plans, prices] = await Promise.all([
            PlanModel.find({ isActive: true, visibility: PlanVisibility.PUBLIC })
                .sort({ type: 1, name: 1 })
                .lean()
                .exec(),
            PlanPriceModel.find({ isActive: true }).populate("currencyId", "code symbol name").lean().exec(),
        ]);

        const mappedPlans = plans.map((plan) => {
            const planPrices = prices
                .filter((p) => p.planId.toString() === plan._id.toString())
                .map((price) => ({
                    _id: price._id,
                    billingInterval: price.billingInterval,
                    amountMinor: price.amountMinor,
                    currency: (price.currencyId as any)?.code || BILLING_CONSTANTS.DEFAULT_CURRENCY,
                    currencySymbol: (price.currencyId as any)?.symbol || "₹",
                }));

            return {
                _id: plan._id,
                name: plan.name,
                code: plan.code,
                type: plan.type,
                description: plan.description,
                prices: planPrices,
            };
        });

        return { plans: mappedPlans };
    }

    async createSubscriptionCheckout(
        userId: string,
        input: SubscribeBillingInput,
        _context?: IAuditLogContext,
    ): Promise<ICheckoutResponse> {
        const planPrice = await PlanPriceModel.findOne({ _id: input.planPriceId, isActive: true })
            .populate("currencyId", "code")
            .lean()
            .exec();

        if (!planPrice) {
            throw new AppError(BillingMessages.PLAN_PRICE_NOT_FOUND, 404);
        }

        const plan = await PlanModel.findOne({ _id: planPrice.planId, isActive: true }).lean().exec();
        if (!plan) {
            throw new AppError(BillingMessages.PLAN_INACTIVE, 404);
        }

        if (plan.type === PlanType.FREE) {
            throw new AppError(BillingMessages.FREE_PLAN_NO_CHECKOUT, 400);
        }

        const currencyCode = (planPrice.currencyId as any)?.code || BILLING_CONSTANTS.DEFAULT_CURRENCY;
        const config = getBillingConfig();

        // Check if user already has an active subscription to this exact plan & price
        const currentSub = await UserSubscriptionModel.findOne({
            user: new Types.ObjectId(userId),
            isActive: true,
            status: UserSubscriptionStatus.ACTIVE,
        })
            .lean()
            .exec();

        if (
            currentSub &&
            currentSub.planPriceId?.toString() === planPrice._id.toString() &&
            currentSub.currentPeriodEnd &&
            currentSub.currentPeriodEnd > new Date() &&
            !currentSub.cancelAtPeriodEnd
        ) {
            throw new AppError(BillingMessages.ALREADY_SUBSCRIBED, 409);
        }

        // Check if an unexpired pending checkout intent already exists for this user and price
        const existingIntent = await this.repository.findActivePendingIntentByUserAndPrice(
            userId,
            planPrice._id.toString(),
        );

        if (existingIntent) {
            return {
                provider: BillingProviderName.RAZORPAY,
                keyId: config.razorpay.keyId,
                subscriptionId: existingIntent.providerSubscriptionId,
                checkoutIntentId: existingIntent.checkoutIntentId,
                plan: {
                    code: plan.code,
                    name: plan.name,
                    billingInterval: existingIntent.billingInterval,
                    currency: existingIntent.currency,
                    amountMinor: existingIntent.amountMinor,
                },
            };
        }

        // Resolve or create gateway plan mapping
        const environment = config.environment;
        let mapping = await this.repository.findPlanMapping(
            planPrice._id.toString(),
            BillingProviderName.RAZORPAY,
            environment,
        );

        if (!mapping) {
            const providerPlan = await this.provider.createPlan({
                name: `${plan.name} ${planPrice.billingInterval}`,
                amountMinor: planPrice.amountMinor,
                currency: currencyCode,
                interval: planPrice.billingInterval.toLowerCase() as "monthly" | "yearly",
                description: `${plan.name} plan billed ${planPrice.billingInterval.toLowerCase()}`,
                notes: {
                    planId: plan._id.toString(),
                    planPriceId: planPrice._id.toString(),
                },
            });

            mapping = await this.repository.createPlanMapping({
                planPriceId: planPrice._id,
                provider: BillingProviderName.RAZORPAY,
                providerPlanId: providerPlan.id,
                amountMinor: planPrice.amountMinor,
                currency: currencyCode,
                billingInterval: planPrice.billingInterval,
                environment,
                status: GatewayPlanMappingStatus.ACTIVE,
            });
        }

        // Create subscription on Razorpay
        const totalCount =
            planPrice.billingInterval === "YEARLY"
                ? BILLING_CONSTANTS.DEFAULT_TOTAL_CYCLES_YEARLY
                : BILLING_CONSTANTS.DEFAULT_TOTAL_CYCLES_MONTHLY;

        const checkoutIntentId = crypto.randomUUID();

        const providerSub = await this.provider.createSubscription({
            planId: mapping.providerPlanId,
            totalCount,
            quantity: 1,
            customerNotify: true,
            notes: {
                userId,
                planPriceId: planPrice._id.toString(),
                checkoutIntentId,
            },
        });

        const expiresAt = new Date(Date.now() + BILLING_CONSTANTS.DEFAULT_INTENT_EXPIRY_MINUTES * 60 * 1000);

        await this.repository.createCheckoutIntent({
            checkoutIntentId,
            user: new Types.ObjectId(userId),
            planId: plan._id,
            planPriceId: planPrice._id,
            billingInterval: planPrice.billingInterval,
            provider: BillingProviderName.RAZORPAY,
            providerSubscriptionId: providerSub.id,
            amountMinor: planPrice.amountMinor,
            currency: currencyCode,
            status: CheckoutIntentStatus.PENDING,
            expiresAt,
            metadata: { shortUrl: providerSub.shortUrl },
        });

        // Record initial payment attempt
        await this.paymentService.recordPaymentAttempt({
            user: userId,
            planId: plan._id.toString(),
            planPriceId: planPrice._id.toString(),
            billingInterval: planPrice.billingInterval,
            provider: BillingProviderName.RAZORPAY,
            providerSubscriptionId: providerSub.id,
            amountMinor: planPrice.amountMinor,
            currency: currencyCode,
            metadata: { checkoutIntentId },
        });

        return {
            provider: BillingProviderName.RAZORPAY,
            keyId: config.razorpay.keyId,
            subscriptionId: providerSub.id,
            checkoutIntentId,
            plan: {
                code: plan.code,
                name: plan.name,
                billingInterval: planPrice.billingInterval,
                currency: currencyCode,
                amountMinor: planPrice.amountMinor,
            },
        };
    }

    async verifyCheckoutCallback(userId: string, input: IVerifyCheckoutInput, context?: IAuditLogContext) {
        const intent = await this.repository.findCheckoutIntentById(input.checkoutIntentId);
        if (!intent || intent.user.toString() !== userId) {
            throw new AppError(BillingMessages.CHECKOUT_INTENT_NOT_FOUND, 404);
        }

        if (intent.providerSubscriptionId !== input.razorpaySubscriptionId) {
            throw new AppError("Subscription ID mismatch in callback", 400);
        }

        // Authoritative signature verification
        const isSignatureValid = this.provider.verifySubscriptionCheckoutSignature(
            input.razorpayPaymentId,
            input.razorpaySubscriptionId,
            input.razorpaySignature,
        );

        if (!isSignatureValid) {
            throw new AppError(BillingMessages.SIGNATURE_INVALID, 400);
        }

        // Fetch authoritative state from provider
        const [sub, payment] = await Promise.all([
            this.provider.getSubscription(input.razorpaySubscriptionId),
            this.provider.getPayment(input.razorpayPaymentId),
        ]);

        const currentStart = sub.currentStart ?? new Date();
        const currentEnd = sub.currentEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Record captured payment
        await this.paymentService.recordCapturedPayment({
            user: userId,
            planId: intent.planId,
            planPriceId: intent.planPriceId,
            billingInterval: intent.billingInterval,
            provider: BillingProviderName.RAZORPAY,
            providerPaymentId: input.razorpayPaymentId,
            providerSubscriptionId: input.razorpaySubscriptionId,
            providerSignature: input.razorpaySignature,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            billingPeriodStart: currentStart,
            billingPeriodEnd: currentEnd,
            capturedAt: payment.createdAt,
        });

        const planId = (intent.planId as any)?._id ?? intent.planId;
        const planPriceId = (intent.planPriceId as any)?._id ?? intent.planPriceId;

        // Apply verified billing event to user subscription
        const updatedSubscription = await this.userSubscriptionService.applyVerifiedBillingEvent(
            {
                user: userId,
                plan: planId,
                planPriceId: planPriceId,
                billingInterval: intent.billingInterval,
                status: UserSubscriptionStatus.ACTIVE,
                isActive: true,
                startDate: currentStart,
                currentPeriodStart: currentStart,
                currentPeriodEnd: currentEnd,
                endDate: currentEnd,
                autoRenew: true,
                cancelAtPeriodEnd: false,
                paymentId: input.razorpayPaymentId,
                paymentProvider: BillingProviderName.RAZORPAY,
                providerSubscriptionId: input.razorpaySubscriptionId,
                action: AuditLogAction.UPDATE,
                reason: "Checkout callback verified successfully",
            },
            context,
        );

        await this.repository.updateCheckoutIntentStatus(
            intent.checkoutIntentId,
            CheckoutIntentStatus.COMPLETED,
        );

        return {
            verified: true,
            subscription: updatedSubscription,
        };
    }

    async getCurrentBilling(userId: string) {
        const subscription = await this.userSubscriptionService.getCurrentSubscription(userId);
        const payments = await this.paymentService.listUserPayments(userId, 1, 5);

        return {
            subscription,
            recentPayments: payments.data,
        };
    }

    async cancelSubscription(userId: string, input: ICancelBillingInput, context?: IAuditLogContext) {
        const sub = await UserSubscriptionModel.findOne({
            user: new Types.ObjectId(userId),
            isActive: true,
        })
            .select("+paymentProvider +providerSubscriptionId")
            .lean()
            .exec();

        if (!sub) {
            throw new AppError("No active subscription found to cancel.", 404);
        }

        // If on Free tier or no provider subscription, standard cancellation
        if (!sub.providerSubscriptionId || sub.paymentProvider !== BillingProviderName.RAZORPAY) {
            return this.userSubscriptionService.requestCancellation(userId, input, context);
        }

        // Provider subscription cancellation
        const cancelAtCycleEnd = !input.immediate;
        try {
            await this.provider.cancelSubscription({
                providerSubscriptionId: sub.providerSubscriptionId,
                cancelAtCycleEnd,
            });
        } catch (error) {
            throw new AppError(
                error instanceof AppError ? error.message : BillingMessages.CANCELLATION_FAILED,
                502,
            );
        }

        const now = new Date();
        const effectiveAt = cancelAtCycleEnd ? (sub.currentPeriodEnd ?? sub.endDate ?? now) : now;

        const updated = await this.userSubscriptionService.applyVerifiedBillingEvent(
            {
                user: userId,
                plan: sub.plan,
                planPriceId: sub.planPriceId,
                billingInterval: sub.billingInterval,
                status: cancelAtCycleEnd ? UserSubscriptionStatus.ACTIVE : UserSubscriptionStatus.CANCELED,
                isActive: cancelAtCycleEnd,
                cancelAtPeriodEnd: cancelAtCycleEnd,
                cancellationEffectiveAt: effectiveAt,
                cancellationReason: input.reason ?? "User requested cancellation",
                canceledAt: now,
                autoRenew: false,
                providerSubscriptionId: sub.providerSubscriptionId,
                paymentProvider: BillingProviderName.RAZORPAY,
                action: AuditLogAction.UPDATE,
                reason: input.reason ?? "Subscription cancellation requested",
            },
            context,
        );

        return updated;
    }

    async changePlan(userId: string, input: ChangePlanBillingInput, context?: IAuditLogContext) {
        if (input.targetPlanId) {
            const plan = await PlanModel.findOne({ _id: input.targetPlanId, isActive: true }).lean().exec();
            if (!plan) throw new AppError(BillingMessages.PLAN_INACTIVE, 404);
            if (plan.type === PlanType.FREE) {
                return this.cancelSubscription(
                    userId,
                    { reason: "Downgrade to Free plan", immediate: false },
                    context,
                );
            }
        }

        if (!input.targetPlanPriceId) {
            throw new AppError(BillingMessages.PLAN_PRICE_NOT_FOUND, 400);
        }

        const targetPrice = await PlanPriceModel.findOne({ _id: input.targetPlanPriceId, isActive: true })
            .populate("planId")
            .lean()
            .exec();

        if (!targetPrice) {
            throw new AppError(BillingMessages.PLAN_PRICE_NOT_FOUND, 404);
        }

        const targetPlan = targetPrice.planId as any;
        if (!targetPlan || !targetPlan.isActive) {
            throw new AppError(BillingMessages.PLAN_INACTIVE, 404);
        }

        // If changing to Free, schedule cancellation of paid subscription at period end
        if (targetPlan.type === PlanType.FREE) {
            return this.cancelSubscription(
                userId,
                { reason: "Downgrade to Free plan", immediate: false },
                context,
            );
        }

        // Paid upgrade / downgrade: initialize checkout for the new target plan
        return this.createSubscriptionCheckout(userId, { planPriceId: input.targetPlanPriceId }, context);
    }

    async getBillingHistory(userId: string, input: GetBillingHistoryInput) {
        return this.paymentService.listUserPayments(userId, input.page, input.limit);
    }
}
