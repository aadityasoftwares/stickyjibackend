import { UserSubscriptionService } from "../services/usersubscription.service.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";

// Reusable by the existing worker infrastructure; each invocation processes one bounded page.
export const runUserSubscriptionReconciliation = (
    batchSize = USER_SUBSCRIPTION_CONSTANTS.RECONCILE_BATCH_SIZE as number,
    afterId?: string,
) => new UserSubscriptionService().reconcileExpiredSubscriptions(batchSize, afterId);
