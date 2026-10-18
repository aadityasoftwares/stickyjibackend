import { startWorkspaceRetentionScheduler } from "./modules/workspace/schedulers/workspaceRetention.scheduler.js";
import { startUserSubscriptionReconciliationScheduler } from "./modules/usersubscription/schedulers/usersubscriptionReconciliation.scheduler.js";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { initializeDatabaseIfRequired } from "./database/initialization/database-initializer.js";
import { startStickyNoteRetentionScheduler } from "./modules/stickynotes/schedulers/stickyNoteRetention.scheduler.js";

const PORT = process.env.PORT || 5000;

console.log("Environment Variables:");
console.log("PORT:", process.env.PORT);
console.log("MONGO_URI:", process.env.MONGO_URI);
console.log("CLIENT_URL:", process.env.CLIENT_URL);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "Loaded ✅" : "Not Found ❌");

async function startServer() {
    try {
        await connectDatabase();
        await initializeDatabaseIfRequired();

        startStickyNoteRetentionScheduler();
        startWorkspaceRetentionScheduler();
        startUserSubscriptionReconciliationScheduler();

        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Server startup failed", error);
        process.exit(1);
    }
}

startServer();
