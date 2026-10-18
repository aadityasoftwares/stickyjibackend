export const SubscriptionPaymentMessages = {
    PAYMENT_NOT_FOUND: "Subscription payment record not found.",
    PAYMENT_RECORDED: "Subscription payment recorded successfully.",
    INVALID_AMOUNT: "Payment amount must be a positive integer in minor units.",
    INVALID_CURRENCY: "Payment currency does not match required currency.",
    UNAUTHORIZED: "Unauthorized access to payment records.",
    FETCHED: "Payment details fetched successfully.",
    FETCHED_ALL: "Payment history fetched successfully.",
} as const;
