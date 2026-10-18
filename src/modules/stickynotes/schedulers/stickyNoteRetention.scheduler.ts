import cron from "node-cron";
import { runStickyNoteRetentionCleanup } from "../jobs/stickyNoteRetention.job.js";
let started = false;
let running = false;
export const startStickyNoteRetentionScheduler = (): void => {
    if (started) return;
    cron.schedule(
        "0 3 * * *",
        async () => {
            if (running) return;
            running = true;
            try {
                const result = await runStickyNoteRetentionCleanup();
                console.log("[StickyNoteRetention] Cleanup completed:", result);
            } catch (error) {
                console.error("[StickyNoteRetention] Cleanup failed:", error);
            } finally {
                running = false;
            }
        },
        { timezone: "UTC" },
    );
    started = true;
    console.log("[StickyNoteRetention] Scheduler started.");
};
