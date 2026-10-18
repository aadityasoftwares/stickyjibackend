import { UserSubscriptionStatus } from "./usersubscription.enums.js";

export const USER_SUBSCRIPTION_CONSTANTS = {
    DEFAULT_STATUS: UserSubscriptionStatus.PENDING,
    DEFAULT_AUTO_RENEW: false,
    DEFAULT_ACTIVE: false,
    REASON_MAX_LENGTH: 500,
    SEARCH_MAX_LENGTH: 100,
    SORT_FIELDS: ["createdAt", "updatedAt", "startDate", "endDate", "status"],
    DEFAULT_SORT_BY: "createdAt",
    DEFAULT_SORT_ORDER: "desc",
    RECONCILE_BATCH_SIZE: 100,
    MAX_BATCH_SIZE: 500,
    MAX_AUDIT_OUTBOX: 100,
    RECONCILIATION_CRON: "*/5 * * * *",
    // This delays state reconciliation only. It does not extend entitlement validity.
    RECONCILIATION_DELAY_MS: 24 * 60 * 60 * 1000,
} as const;

export const USER_SUBSCRIPTION_TRANSITIONS: Readonly<
    Record<UserSubscriptionStatus, readonly UserSubscriptionStatus[]>
> = {
    [UserSubscriptionStatus.PENDING]: [
        UserSubscriptionStatus.ACTIVE,
        UserSubscriptionStatus.CANCELED,
        UserSubscriptionStatus.EXPIRED,
    ],
    [UserSubscriptionStatus.ACTIVE]: [
        UserSubscriptionStatus.PAST_DUE,
        UserSubscriptionStatus.CANCELED,
        UserSubscriptionStatus.EXPIRED,
    ],
    [UserSubscriptionStatus.PAST_DUE]: [
        UserSubscriptionStatus.ACTIVE,
        UserSubscriptionStatus.CANCELED,
        UserSubscriptionStatus.EXPIRED,
    ],
    [UserSubscriptionStatus.CANCELED]: [],
    [UserSubscriptionStatus.EXPIRED]: [],
};
