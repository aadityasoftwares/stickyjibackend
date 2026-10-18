export interface CreateProviderPlanInput {
    name: string;
    amountMinor: number;
    currency: string;
    interval: "monthly" | "yearly";
    description?: string;
    notes?: Record<string, string>;
}

export interface ProviderPlan {
    id: string;
    interval: number;
    period: "monthly" | "yearly";
    item: {
        id: string;
        name: string;
        amount: number;
        currency: string;
    };
}

export interface CreateProviderSubscriptionInput {
    planId: string;
    totalCount: number;
    quantity?: number;
    customerNotify?: boolean;
    startAt?: Date;
    notes?: Record<string, string>;
}

export interface ProviderSubscription {
    id: string;
    planId: string;
    status: string; // "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired"
    currentStart: Date | null;
    currentEnd: Date | null;
    chargeAt: Date | null;
    endedAt: Date | null;
    totalCount: number;
    paidCount: number;
    remainingCount: number;
    shortUrl?: string;
    notes?: Record<string, string>;
}

export interface CancelProviderSubscriptionInput {
    providerSubscriptionId: string;
    cancelAtCycleEnd: boolean;
}

export interface ProviderPayment {
    id: string;
    amountMinor: number;
    currency: string;
    status: string; // "captured" | "failed" | "authorized" | "refunded"
    orderId?: string;
    method?: string;
    captured: boolean;
    createdAt: Date;
}

export interface IBillingProvider {
    createPlan(input: CreateProviderPlanInput): Promise<ProviderPlan>;
    getPlan(providerPlanId: string): Promise<ProviderPlan>;
    createSubscription(input: CreateProviderSubscriptionInput): Promise<ProviderSubscription>;
    getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
    cancelSubscription(input: CancelProviderSubscriptionInput): Promise<ProviderSubscription>;
    getPayment(providerPaymentId: string): Promise<ProviderPayment>;
    verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean;
    verifySubscriptionCheckoutSignature(
        paymentId: string,
        subscriptionId: string,
        signature: string,
    ): boolean;
}
