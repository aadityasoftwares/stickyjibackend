import cron from "node-cron";
import { runUserSubscriptionReconciliation } from "../jobs/usersubscriptionReconciliation.job.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";

let started = false;
let running = false;
let afterId: string | undefined;

export const startUserSubscriptionReconciliationScheduler = (): void => {
    // Enable after the documented data/index migration has completed.
    if (started || process.env.USER_SUBSCRIPTION_RECONCILIATION_ENABLED !== "true") return;
    cron.schedule(USER_SUBSCRIPTION_CONSTANTS.RECONCILIATION_CRON, async () => {
        if (running) return;
        running = true;
        try {
            const result = await runUserSubscriptionReconciliation(
                USER_SUBSCRIPTION_CONSTANTS.RECONCILE_BATCH_SIZE, afterId,
            );
            afterId = result.nextCursor ?? undefined;
            console.log("[UserSubscription] Reconciliation completed:", result);
        } catch (error) {
            console.error("[UserSubscription] Reconciliation failed:", error);
        } finally {
            running = false;
        }
    }, { timezone: "UTC" });
    started = true;
};
