import mongoose from "mongoose";
import dotenv from "dotenv";
import { mongoConnectionOptions } from "../config/mongoConnectionOptions.js";
import { pathToFileURL } from "node:url";
import { DatabaseInitializer } from "../database/initialization/database-initializer.js";

export async function runVerifyDatabaseInitialization(args = process.argv.slice(2)): Promise<number> {
    try {
        let envFile: string | undefined;
        for (let i = 0; i < args.length; i++) {
            if (args[i] === "--env-file") {
                envFile = args[++i];
            }
        }
        dotenv.config({ path: envFile ?? ".env", quiet: true });

        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error("[db:init:verify] Error: MONGO_URI environment variable is required.");
            return 1;
        }

        console.log(`[db:init:verify] Connecting to MongoDB...`);
        await mongoose.connect(uri, mongoConnectionOptions({ serverSelectionTimeoutMS: 10000 }));

        const initializer = new DatabaseInitializer();
        const isInit = await initializer.isInitialized();
        const verification = await initializer.verify();

        console.log(
            `[db:init:verify] Initialization state record: ${isInit ? "COMPLETED" : "NOT COMPLETED"}`,
        );
        console.log(`[db:init:verify] Verification status: ${verification.valid ? "PASSED" : "FAILED"}`);
        console.log(`[db:init:verify] Details:`);
        for (const [key, val] of Object.entries(verification.details)) {
            console.log(
                `  - ${key}: count=${val.count}, expected=${val.expected ?? "N/A"}, valid=${val.valid ? "YES" : "NO"}`,
            );
        }

        if (verification.errors.length > 0) {
            console.error(`[db:init:verify] Discrepancies found:`);
            for (const err of verification.errors) {
                console.error(`  - ${err}`);
            }
        }

        return isInit && verification.valid ? 0 : 1;
    } catch (error: any) {
        console.error(`[db:init:verify] Error during verification:`, error?.message || error);
        return 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await runVerifyDatabaseInitialization();
}
