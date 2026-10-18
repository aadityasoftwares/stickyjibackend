import { AppError } from "../../../utils/errors/app.error.js";
import { USER_SUBSCRIPTION_CONSTANTS, USER_SUBSCRIPTION_TRANSITIONS } from "../constants/usersubscription.constants.js";
import { UserSubscriptionStatus } from "../constants/usersubscription.enums.js";
import { UserSubscriptionMessages } from "../constants/usersubscription.messages.js";
import type { UserSubscriptionRecord } from "../interfaces/usersubscription.interface.js";

export class UserSubscriptionValidation {
    static assertTransition(from: UserSubscriptionStatus, to: UserSubscriptionStatus): void {
        if (!USER_SUBSCRIPTION_TRANSITIONS[from]?.includes(to)) {
            throw new AppError(UserSubscriptionMessages.INVALID_TRANSITION, 409);
        }
    }

    static assertPeriod(subscription: Pick<UserSubscriptionRecord, "startDate" | "endDate" | "currentPeriodStart" | "currentPeriodEnd">): void {
        const { startDate, endDate, currentPeriodStart, currentPeriodEnd } = subscription;
        const valid = (date: Date) => date instanceof Date && Number.isFinite(date.getTime());
        if (!valid(startDate) ||
            (endDate !== null && (!valid(endDate) || endDate <= startDate)) ||
            (currentPeriodStart !== null && (!valid(currentPeriodStart) || currentPeriodStart < startDate)) ||
            (currentPeriodEnd !== null && (!valid(currentPeriodEnd) || !currentPeriodStart ||
                currentPeriodEnd <= currentPeriodStart || (endDate !== null && currentPeriodEnd > endDate)))) {
            throw new AppError(UserSubscriptionMessages.INVALID_PERIOD, 409);
        }
    }

    static reconciliationStatus(subscription: UserSubscriptionRecord, now: Date): UserSubscriptionStatus | null {
        if (!subscription.isActive ||
            ![UserSubscriptionStatus.ACTIVE, UserSubscriptionStatus.PAST_DUE].includes(subscription.status)) {
            return null;
        }
        if (subscription.cancelAtPeriodEnd && subscription.cancellationEffectiveAt &&
            subscription.cancellationEffectiveAt <= now) {
            return UserSubscriptionStatus.CANCELED;
        }
        const end = subscription.currentPeriodEnd ?? subscription.endDate;
        if (end && end.getTime() + USER_SUBSCRIPTION_CONSTANTS.RECONCILIATION_DELAY_MS <= now.getTime()) {
            return UserSubscriptionStatus.EXPIRED;
        }
        return null;
    }
}
