import type { NextFunction, Request, Response } from "express";
import { RequestUtil } from "../../../utils/request.util.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { BillingMessages } from "../constants/billing.messages.js";
import { BillingProviderName } from "../constants/billing.enums.js";
import { RazorpayProvider } from "../providers/razorpay.provider.js";
import { BillingReconciliationService } from "../services/billing-reconciliation.service.js";
import { BillingWebhookService } from "../services/billing-webhook.service.js";
import { BillingService } from "../services/billing.service.js";
import { cancelBillingSchema } from "../validations/cancelBilling.validation.js";
import { changePlanBillingSchema } from "../validations/changePlanBilling.validation.js";
import { getBillingHistorySchema } from "../validations/getBillingHistory.validation.js";
import { subscribeBillingSchema } from "../validations/subscribeBilling.validation.js";
import { verifyCheckoutCallbackSchema } from "../validations/verifyCheckoutCallback.validation.js";

export class BillingController {
    private readonly billingService: BillingService;
    private readonly webhookService: BillingWebhookService;
    private readonly reconciliationService: BillingReconciliationService;

    constructor() {
        const provider = new RazorpayProvider();
        this.billingService = new BillingService(provider);
        this.webhookService = new BillingWebhookService(provider);
        this.reconciliationService = new BillingReconciliationService(provider);
    }

    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    getPlans = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.billingService.getBillingPlans();
            return res.status(200).json(ResponseUtil.success(BillingMessages.PLANS_FETCHED, data));
        } catch (error) {
            next(error);
        }
    };

    subscribe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const parsed = subscribeBillingSchema.parse(req.body);
            const data = await this.billingService.createSubscriptionCheckout(
                userId,
                parsed,
                this.getAuditContext(req),
            );
            return res.status(201).json(ResponseUtil.created(BillingMessages.CHECKOUT_INITIALIZED, data));
        } catch (error) {
            next(error);
        }
    };

    verifyCallback = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const parsed = verifyCheckoutCallbackSchema.parse(req.body);
            const data = await this.billingService.verifyCheckoutCallback(
                userId,
                parsed,
                this.getAuditContext(req),
            );
            return res.status(200).json(ResponseUtil.success(BillingMessages.CHECKOUT_VERIFIED, data));
        } catch (error) {
            next(error);
        }
    };

    getCurrent = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const data = await this.billingService.getCurrentBilling(userId);
            return res.status(200).json(ResponseUtil.success(BillingMessages.CURRENT_FETCHED, data));
        } catch (error) {
            next(error);
        }
    };

    cancel = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const parsed = cancelBillingSchema.parse(req.body || {});
            const data = await this.billingService.cancelSubscription(
                userId,
                parsed,
                this.getAuditContext(req),
            );
            return res.status(200).json(ResponseUtil.success(BillingMessages.CANCELLATION_SCHEDULED, data));
        } catch (error) {
            next(error);
        }
    };

    changePlan = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const parsed = changePlanBillingSchema.parse(req.body);
            const data = await this.billingService.changePlan(userId, parsed, this.getAuditContext(req));
            return res.status(200).json(ResponseUtil.success(BillingMessages.PLAN_CHANGE_SCHEDULED, data));
        } catch (error) {
            next(error);
        }
    };

    getHistory = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const parsed = getBillingHistorySchema.parse(req.query);
            const data = await this.billingService.getBillingHistory(userId, parsed);
            return res.status(200).json({
                ...ResponseUtil.success(BillingMessages.HISTORY_FETCHED, data.data),
                meta: data.pagination,
            });
        } catch (error) {
            next(error);
        }
    };

    handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const signature = (req.get("x-razorpay-signature") || "") as string;
            const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));
            const result = await this.webhookService.processWebhook(rawBody, signature, req.headers);
            return res.status(200).json(ResponseUtil.success(BillingMessages.WEBHOOK_PROCESSED, result));
        } catch (error) {
            next(error);
        }
    };

    reconcileAsAdmin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const batchSize = req.body?.batchSize ? Number(req.body.batchSize) : 50;
            const result = await this.reconciliationService.reconcile(batchSize);
            return res
                .status(200)
                .json(ResponseUtil.success(BillingMessages.RECONCILIATION_COMPLETED, result));
        } catch (error) {
            next(error);
        }
    };
}
