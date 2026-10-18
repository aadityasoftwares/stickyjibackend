import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import { UserModel } from "../modules/user/models/user.model.js";
import { UserStatus, UserAuthProvider } from "../modules/user/constants/user.enums.js";
import { UserSubscriptionService } from "../modules/usersubscription/services/usersubscription.service.js";
import { UserSubscriptionRepository } from "../modules/usersubscription/repositories/usersubscription.repository.js";
import { AppError } from "../utils/errors/app.error.js";

export interface BackfillOptions {
    mode: "dry-run" | "apply";
    envFile?: string;
}

export interface BackfillSummary {
    mode: "dry-run" | "apply";
    totalScanned: number;
    eligibleForActivation: number;
    activated: number;
    freeSubscriptionsEnsured: number;
    skippedLockedOrFailedLogins: number;
    skippedDeleted: number;
    skippedNonLocal: number;
    alreadyHadActiveSubscription: number;
    errors: Array<{ userId: string; email: string; error: string }>;
}

export function parseBackfillArguments(args: string[]): BackfillOptions {
    const modes = args.filter((arg) => ["--dry-run", "--apply"].includes(arg));
    if (modes.length > 1) {
        throw new AppError("Choose at most one of --dry-run or --apply.", 400);
    }

    let envFile: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--env-file") {
            const val = args[++i];
            if (!val || val.startsWith("--")) throw new AppError("--env-file requires a path.", 400);
            envFile = val;
        } else if (!["--dry-run", "--apply"].includes(arg!)) {
            throw new AppError(`Unknown backfill argument: ${arg}`, 400);
        }
    }

    const mode = modes[0] === "--apply" ? "apply" : "dry-run";
    return { mode, envFile };
}

export async function runPendingUsersBackfill(
    options: BackfillOptions,
    injectedServices?: {
        userSubscriptionService?: UserSubscriptionService;
        subscriptionRepository?: UserSubscriptionRepository;
    },
): Promise<BackfillSummary> {
    const userSubscriptionService =
        injectedServices?.userSubscriptionService ?? new UserSubscriptionService();
    const subscriptionRepository =
        injectedServices?.subscriptionRepository ?? new UserSubscriptionRepository();

    const summary: BackfillSummary = {
        mode: options.mode,
        totalScanned: 0,
        eligibleForActivation: 0,
        activated: 0,
        freeSubscriptionsEnsured: 0,
        skippedLockedOrFailedLogins: 0,
        skippedDeleted: 0,
        skippedNonLocal: 0,
        alreadyHadActiveSubscription: 0,
        errors: [],
    };

    // Find all users in PENDING status
    const pendingUsers = await UserModel.find({
        status: UserStatus.PENDING,
    }).lean();

    summary.totalScanned = pendingUsers.length;
    const now = new Date();

    for (const user of pendingUsers) {
        const userId = user._id.toString();

        if (user.isDeleted) {
            summary.skippedDeleted++;
            continue;
        }

        if (user.authProvider !== UserAuthProvider.LOCAL) {
            summary.skippedNonLocal++;
            continue;
        }

        // Security check: If account was locked or has exceeded failed login attempts, do not auto-activate
        const isLocked = user.lockedUntil && new Date(user.lockedUntil) > now;
        const tooManyAttempts = (user.loginAttempts ?? 0) >= 5;
        if (isLocked || tooManyAttempts) {
            summary.skippedLockedOrFailedLogins++;
            continue;
        }

        // Eligible user who was registered and left PENDING solely because email was unverified
        summary.eligibleForActivation++;

        const existingSub = await subscriptionRepository.findCurrentByUser(userId);
        if (existingSub) {
            summary.alreadyHadActiveSubscription++;
        }

        if (options.mode === "dry-run") {
            console.log(
                `[DRY-RUN] Would activate user: ${user.email} (${userId}), alreadyHasSub: ${Boolean(existingSub)}`,
            );
        } else {
            try {
                // Activate account
                await UserModel.updateOne(
                    { _id: user._id, status: UserStatus.PENDING },
                    { $set: { status: UserStatus.ACTIVE } },
                );
                summary.activated++;

                // Provision Free subscription idempotently
                await userSubscriptionService.ensureFreeSubscription(userId);
                summary.freeSubscriptionsEnsured++;
                console.log(
                    `[APPLIED] Activated user and ensured Free subscription: ${user.email} (${userId})`,
                );
            } catch (err: any) {
                console.error(`Failed to repair pending user ${user.email}:`, err);
                summary.errors.push({
                    userId,
                    email: user.email,
                    error: err.message || String(err),
                });
            }
        }
    }

    return summary;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
    try {
        const options = parseBackfillArguments(args);
        dotenv.config({ path: options.envFile ?? ".env", quiet: true });

        const uri = process.env.MONGO_URI;
        if (!uri) throw new AppError("MONGO_URI environment variable is required.", 400);

        await mongoose.connect(uri);
        console.log(`[BACKFILL] Connected to MongoDB. Running in ${options.mode.toUpperCase()} mode...`);

        const summary = await runPendingUsersBackfill(options);

        console.log("\n================ BACKFILL SUMMARY ================");
        console.log(`Mode:                           ${summary.mode.toUpperCase()}`);
        console.log(`Total Pending Users Scanned:    ${summary.totalScanned}`);
        console.log(`Eligible for Activation:        ${summary.eligibleForActivation}`);
        console.log(`Activated:                      ${summary.activated}`);
        console.log(`Free Subscriptions Ensured:     ${summary.freeSubscriptionsEnsured}`);
        console.log(`Already Had Subscription:       ${summary.alreadyHadActiveSubscription}`);
        console.log(`Skipped (Locked/Excess Logins): ${summary.skippedLockedOrFailedLogins}`);
        console.log(`Skipped (Deleted):              ${summary.skippedDeleted}`);
        console.log(`Skipped (Non-local Auth):       ${summary.skippedNonLocal}`);
        console.log(`Errors:                         ${summary.errors.length}`);
        console.log("==================================================\n");

        await mongoose.disconnect();
        return summary.errors.length === 0 ? 0 : 1;
    } catch (error: any) {
        console.error("[BACKFILL ERROR]", error.message || error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        return 1;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().then((code) => process.exit(code));
}
