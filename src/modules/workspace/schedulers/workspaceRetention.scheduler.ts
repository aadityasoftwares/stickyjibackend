import cron from "node-cron";
import { runWorkspaceRetentionCleanup } from "../jobs/workspaceRetention.job.js";
let started = false;
let running = false;
export const startWorkspaceRetentionScheduler = (): void => {
    if (started) return;
    cron.schedule("0 3 * * *", async () => {
        if (running) return;
        running = true;
        try {
            const result = await runWorkspaceRetentionCleanup();
            console.log("[WorkspaceRetention] Cleanup completed:", result);
        } catch (error) {
            console.error("[WorkspaceRetention] Cleanup failed:", error);
        } finally { running = false; }
    }, { timezone: "UTC" });
    started = true;
    console.log("[WorkspaceRetention] Scheduler started.");
};
