import crypto from "node:crypto";
import { AppError } from "../../../utils/errors/app.error.js";
import { BILLING_CONSTANTS } from "../constants/billing.constants.js";
import { BillingMessages } from "../constants/billing.messages.js";
import type {
    CancelProviderSubscriptionInput,
    CreateProviderPlanInput,
    CreateProviderSubscriptionInput,
    IBillingProvider,
    ProviderPayment,
    ProviderPlan,
    ProviderSubscription,
} from "../interfaces/billing-provider.interface.js";
import { getBillingConfig } from "../config/billing.config.js";

export class RazorpayProvider implements IBillingProvider {
    private readonly baseUrl = "https://api.razorpay.com/v1";
    private readonly keyId: string;
    private readonly keySecret: string;
    private readonly webhookSecret: string;

    constructor(credentials?: { keyId: string; keySecret: string; webhookSecret?: string }) {
        if (credentials) {
            this.keyId = credentials.keyId;
            this.keySecret = credentials.keySecret;
            this.webhookSecret = credentials.webhookSecret ?? "";
        } else {
            const config = getBillingConfig();
            this.keyId = config.razorpay.keyId;
            this.keySecret = config.razorpay.keySecret;
            this.webhookSecret = config.razorpay.webhookSecret;
        }
    }

    private getAuthHeader(): string {
        if (!this.keyId || !this.keySecret) {
            throw new AppError(BillingMessages.PROVIDER_UNCONFIGURED, 503, "PROVIDER_UNCONFIGURED");
        }
        const token = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
        return `Basic ${token}`;
    }

    private async request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const method = options.method ?? (options.body ? "POST" : "GET");

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    Authorization: this.getAuthHeader(),
                    "Content-Type": "application/json",
                },
                body: options.body ? JSON.stringify(options.body) : undefined,
                signal: AbortSignal.timeout(BILLING_CONSTANTS.PROVIDER_TIMEOUT_MS),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const message =
                    data &&
                    typeof data === "object" &&
                    "error" in data &&
                    typeof (data as any).error?.description === "string"
                        ? (data as any).error.description
                        : `Razorpay API call failed with status ${response.status}`;
                throw new AppError(message, response.status >= 500 ? 502 : 400, "RAZORPAY_API_ERROR");
            }

            return data as T;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError(
                error instanceof Error ? error.message : BillingMessages.PROVIDER_ERROR,
                502,
                "RAZORPAY_NETWORK_ERROR",
            );
        }
    }

    async createPlan(input: CreateProviderPlanInput): Promise<ProviderPlan> {
        const payload = {
            period: input.interval,
            interval: 1,
            item: {
                name: input.name,
                amount: input.amountMinor,
                currency: input.currency.toUpperCase(),
                description: input.description ?? "",
            },
            notes: input.notes ?? {},
        };

        const res = await this.request<any>("/plans", { body: payload });
        return {
            id: res.id,
            interval: res.interval,
            period: res.period,
            item: {
                id: res.item?.id,
                name: res.item?.name,
                amount: res.item?.amount,
                currency: res.item?.currency,
            },
        };
    }

    async getPlan(providerPlanId: string): Promise<ProviderPlan> {
        const res = await this.request<any>(`/plans/${encodeURIComponent(providerPlanId)}`);
        return {
            id: res.id,
            interval: res.interval,
            period: res.period,
            item: {
                id: res.item?.id,
                name: res.item?.name,
                amount: res.item?.amount,
                currency: res.item?.currency,
            },
        };
    }

    async createSubscription(input: CreateProviderSubscriptionInput): Promise<ProviderSubscription> {
        const payload: Record<string, unknown> = {
            plan_id: input.planId,
            total_count: input.totalCount,
            quantity: input.quantity ?? 1,
            customer_notify: input.customerNotify === false ? 0 : 1,
            notes: input.notes ?? {},
        };

        if (input.startAt) {
            payload.start_at = Math.floor(input.startAt.getTime() / 1000);
        }

        const res = await this.request<any>("/subscriptions", { body: payload });
        return this.mapSubscription(res);
    }

    async getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription> {
        const res = await this.request<any>(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}`);
        return this.mapSubscription(res);
    }

    async cancelSubscription(input: CancelProviderSubscriptionInput): Promise<ProviderSubscription> {
        const payload = {
            cancel_at_cycle_end: input.cancelAtCycleEnd ? 1 : 0,
        };

        const res = await this.request<any>(
            `/subscriptions/${encodeURIComponent(input.providerSubscriptionId)}/cancel`,
            { body: payload },
        );
        return this.mapSubscription(res);
    }

    async getPayment(providerPaymentId: string): Promise<ProviderPayment> {
        const res = await this.request<any>(`/payments/${encodeURIComponent(providerPaymentId)}`);
        return {
            id: res.id,
            amountMinor: res.amount,
            currency: res.currency,
            status: res.status,
            orderId: res.order_id,
            method: res.method,
            captured: Boolean(res.captured),
            createdAt: res.created_at ? new Date(res.created_at * 1000) : new Date(),
        };
    }

    verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
        if (!this.webhookSecret || !signature) return false;
        try {
            const hmac = crypto.createHmac("sha256", this.webhookSecret);
            hmac.update(rawBody);
            const expected = hmac.digest("hex");

            const expectedBuf = Buffer.from(expected, "utf8");
            const signatureBuf = Buffer.from(signature, "utf8");

            if (expectedBuf.length !== signatureBuf.length) {
                return false;
            }

            return crypto.timingSafeEqual(expectedBuf, signatureBuf);
        } catch {
            return false;
        }
    }

    verifySubscriptionCheckoutSignature(
        paymentId: string,
        subscriptionId: string,
        signature: string,
    ): boolean {
        if (!this.keySecret || !paymentId || !subscriptionId || !signature) return false;
        try {
            const message = `${paymentId}|${subscriptionId}`;
            const hmac = crypto.createHmac("sha256", this.keySecret);
            hmac.update(message);
            const expected = hmac.digest("hex");

            const expectedBuf = Buffer.from(expected, "utf8");
            const signatureBuf = Buffer.from(signature, "utf8");

            if (expectedBuf.length !== signatureBuf.length) {
                return false;
            }

            return crypto.timingSafeEqual(expectedBuf, signatureBuf);
        } catch {
            return false;
        }
    }

    private mapSubscription(res: any): ProviderSubscription {
        return {
            id: res.id,
            planId: res.plan_id,
            status: res.status,
            currentStart: res.current_start ? new Date(res.current_start * 1000) : null,
            currentEnd: res.current_end ? new Date(res.current_end * 1000) : null,
            chargeAt: res.charge_at ? new Date(res.charge_at * 1000) : null,
            endedAt: res.ended_at ? new Date(res.ended_at * 1000) : null,
            totalCount: res.total_count ?? 0,
            paidCount: res.paid_count ?? 0,
            remainingCount: res.remaining_count ?? 0,
            shortUrl: res.short_url,
            notes: res.notes,
        };
    }
}
