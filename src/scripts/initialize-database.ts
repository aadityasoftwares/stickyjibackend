import mongoose from "mongoose";
import dotenv from "dotenv";
import { mongoConnectionOptions } from "../config/mongoConnectionOptions.js";
import { pathToFileURL } from "node:url";
import { DatabaseInitializer } from "../database/initialization/database-initializer.js";

export function parseInitArguments(args: string[]): { force: boolean; envFile?: string } {
    let force = false;
    let envFile: string | undefined;

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--force") {
            force = true;
        } else if (arg === "--env-file") {
            const value = args[++index];
            if (!value || value.startsWith("--")) {
                throw new Error("--env-file requires a path.");
            }
            envFile = value;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return { force, envFile };
}

export async function runInitializeDatabase(args = process.argv.slice(2)): Promise<number> {
    try {
        const { force, envFile } = parseInitArguments(args);
        dotenv.config({ path: envFile ?? ".env", quiet: true });

        const uri = process.env.MONGO_URI;
        if (!uri) {
            console.error("[db:init] Error: MONGO_URI environment variable is required.");
            return 1;
        }

        console.log(`[db:init] Connecting to MongoDB...`);
        await mongoose.connect(uri, mongoConnectionOptions({ serverSelectionTimeoutMS: 10000 }));

        const initializer = new DatabaseInitializer();
        const report = await initializer.initialize({ force });

        console.log(`[db:init] Initialization result:`, {
            version: report.version,
            initialized: report.initialized,
            skipped: report.skipped ?? false,
            waited: report.waited ?? false,
            durationMs: report.durationMs,
        });

        return 0;
    } catch (error: any) {
        console.error(`[db:init] Error during database initialization:`, error?.message || error);
        return 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await runInitializeDatabase();
}
