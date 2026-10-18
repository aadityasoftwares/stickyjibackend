// Preserve the persisted lowercase values, including the original "cancelled" spelling.
export enum UserSubscriptionStatus {
    PENDING = "pending",
    ACTIVE = "active",
    PAST_DUE = "past_due",
    CANCELED = "cancelled",
    EXPIRED = "expired",
}

export enum SubscriptionChangeStatus {
    PENDING_PAYMENT = "pending_payment",
    SCHEDULED = "scheduled",
}

export enum SubscriptionAccessState {
    CURRENT = "current",
    AWAITING_RECONCILIATION = "awaiting_reconciliation",
    FREE_FALLBACK = "free_fallback",
}
