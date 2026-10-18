import mongoose from "mongoose";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import { AppError } from "../utils/errors/app.error.js";
import { SubscriptionSeedService } from "../seeders/subscription/services/subscription-seed.service.js";
import { SUBSCRIPTION_SEED_CONSTANTS } from "../seeders/subscription/constants/subscription-seed.constants.js";
import type {
    SubscriptionSeedOptions,
    SubscriptionSeedReport,
} from "../seeders/subscription/interfaces/subscription-seed.interface.js";

export function parseSubscriptionSeedArguments(
    args: string[],
): SubscriptionSeedOptions & { envFile?: string } {
    const modes = args.filter((arg) => ["--dry-run", "--verify", "--apply"].includes(arg));
    if (modes.length > 1) throw new AppError("Choose exactly one of --dry-run, --verify or --apply.", 400);
    let envFile: string | undefined;
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--env-file") {
            const value = args[++index];
            if (!value || value.startsWith("--")) throw new AppError("--env-file requires a path.", 400);
            envFile = value;
        } else if (
            !["--dry-run", "--verify", "--apply", "--sync-defaults", "--ensure-indexes"].includes(arg!)
        ) {
            throw new AppError("Unknown subscription seeder argument.", 400);
        }
    }
    const mode = modes[0] === "--apply" ? "apply" : modes[0] === "--verify" ? "verify" : "dry-run";
    if (mode === "verify" && args.some((arg) => ["--sync-defaults", "--ensure-indexes"].includes(arg))) {
        throw new AppError("Verification accepts no synchronization or index repair flags.", 400);
    }
    // No environment, including production, can write without the explicit --apply flag.
    return {
        mode,
        syncDefaults: args.includes("--sync-defaults"),
        ensureIndexes: args.includes("--ensure-indexes"),
        envFile,
    };
}

export function printSubscriptionSeedReport(report: SubscriptionSeedReport): void {
    const prefix = SUBSCRIPTION_SEED_CONSTANTS.PREFIX;
    const label = report.applied
        ? "Verified applied operations"
        : "Planned operations (not confirmed writes)";
    console.log(prefix, label);
    for (const operation of report.operations) {
        console.log(
            prefix,
            operation.collection,
            operation.key,
            (report.applied ? "" : "WOULD_") + operation.action.toUpperCase(),
            operation.action === "update" ? JSON.stringify(operation.values) : "",
        );
    }
    console.log(prefix, "Counts:", JSON.stringify(report.counts));
    console.log(prefix, report.freePricing);
    console.log(prefix, "Referenced subscription records preserved:", report.referencedSubscriptions);
    if (report.missingIndexes.length)
        console.log(prefix, "Indexes requiring creation:", report.missingIndexes.join(", "));
    for (const conflict of report.conflicts) console.error(prefix, "CONFLICT:", conflict);
    for (const error of report.errors) console.error(prefix, "ERROR:", error);
    console.log(prefix, "Conflicts:", report.conflicts.length, "Errors:", report.errors.length);
    console.log(prefix, "Validation:", report.valid ? "PASSED" : "FAILED");
    console.log(
        prefix,
        "Seeder:",
        report.applied ? "COMPLETED" : report.mode === "apply" ? "NOT COMPLETED" : report.mode.toUpperCase(),
    );
    if (report.partialWritesPossible)
        console.error(
            prefix,
            "A standalone run may have partially completed. Inspect dry-run and resume; no cleanup is performed.",
        );
}

export async function seedDefaultSubscriptions(args = process.argv.slice(2)): Promise<number> {
    try {
        const { envFile, ...options } = parseSubscriptionSeedArguments(args);
        const service = new SubscriptionSeedService();
        service.validateConfiguration();
        const environment = dotenv.config({ path: envFile ?? ".env", quiet: true });
        if (envFile && environment.error)
            throw new AppError("The specified environment file could not be read.", 400);
        const uri = process.env.MONGO_URI;
        if (!uri) throw new AppError(SUBSCRIPTION_SEED_CONSTANTS.DATABASE_REQUIRED, 400);
        console.log(SUBSCRIPTION_SEED_CONSTANTS.PREFIX, "Starting", options.mode);
        // Do not call connectDatabase(): that bootstrap seeds unrelated application data.
        await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
        const report = await service.run(options);
        printSubscriptionSeedReport(report);
        return report.valid ? 0 : 1;
    } catch (error) {
        console.error(
            SUBSCRIPTION_SEED_CONSTANTS.PREFIX,
            error instanceof AppError ? error.message : SUBSCRIPTION_SEED_CONSTANTS.CONNECTION_FAILED,
        );
        return 1;
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await seedDefaultSubscriptions();
}
