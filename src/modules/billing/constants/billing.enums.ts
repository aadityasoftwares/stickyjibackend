export enum BillingProviderName {
    RAZORPAY = "RAZORPAY",
}

export enum BillingEnvironment {
    TEST = "test",
    LIVE = "live",
}

export enum CheckoutIntentStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
}

export enum BillingEventProcessingStatus {
    RECEIVED = "RECEIVED",
    PROCESSING = "PROCESSING",
    PROCESSED = "PROCESSED",
    FAILED = "FAILED",
    IGNORED = "IGNORED",
}

export enum GatewayPlanMappingStatus {
    ACTIVE = "ACTIVE",
    DEPRECATED = "DEPRECATED",
}
