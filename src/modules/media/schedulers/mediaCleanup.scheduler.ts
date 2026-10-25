import cron from "node-cron";
import { runMediaCleanup } from "../jobs/mediaCleanup.job.js";

let started = false;
let running = false;

export const startMediaCleanupScheduler = (): void => {
    if (started) return;

    // Run every hour at minute 15
    cron.schedule(
        "15 * * * *",
        async () => {
            if (running) return;
            running = true;
            try {
                const result = await runMediaCleanup();
                console.log("[MediaCleanup] Cleanup completed:", result);
            } catch (error) {
                console.error("[MediaCleanup] Cleanup failed:", error);
            } finally {
                running = false;
            }
        },
        { timezone: "UTC" },
    );

    started = true;
    console.log("[MediaCleanup] Scheduler started.");
};
