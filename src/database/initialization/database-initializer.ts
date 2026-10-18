import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/errors/app.error.js";
import { InitializationStateModel, InitializationStatus } from "./initialization-state.model.js";
import { InitializationLockManager } from "./initialization-lock.js";
import { SEED_REGISTRY, verifyDatabaseInitialization, type IVerificationResult } from "./seed-registry.js";

export interface IInitializationReport {
    initialized: boolean;
    skipped?: boolean;
    waited?: boolean;
    version: number;
    durationMs?: number;
    details?: Record<string, unknown>;
}

export class DatabaseInitializer {
    public static readonly CURRENT_VERSION = 1;
    public static readonly INITIALIZATION_NAME = "v1_essential_system_seed";

    constructor(private readonly lockManager = new InitializationLockManager()) {}

    async isInitialized(version = DatabaseInitializer.CURRENT_VERSION): Promise<boolean> {
        const state = await InitializationStateModel.findOne({
            version,
            status: InitializationStatus.COMPLETED,
        }).lean();

        return !!state;
    }

    async initialize(options?: {
        force?: boolean;
        runnerId?: string;
        timeoutMs?: number;
    }): Promise<IInitializationReport> {
        if (mongoose.connection.readyState !== 1) {
            throw new AppError("Database connection is not open for initialization.", 500);
        }

        const version = DatabaseInitializer.CURRENT_VERSION;
        const startTime = Date.now();

        // 1. Check if already initialized
        if (!options?.force && (await this.isInitialized(version))) {
            console.log(
                `[DatabaseInitializer] Database is already initialized (version: ${version}). Skipping seed.`,
            );
            return {
                initialized: true,
                skipped: true,
                version,
                durationMs: Date.now() - startTime,
            };
        }

        const runnerId = options?.runnerId || `runner_${process.pid}_${randomUUID().substring(0, 8)}`;
        const timeoutMs = options?.timeoutMs || 60000;

        // 2. Acquire distributed lock
        let lockAcquired = await this.lockManager.acquire(runnerId, timeoutMs);

        if (!lockAcquired) {
            console.log(
                `[DatabaseInitializer] Another instance is currently initializing the database. Waiting for completion...`,
            );

            const waitResult = await this.lockManager.waitForCompletionOrRelease(
                () => this.isInitialized(version),
                timeoutMs,
                1000,
            );

            if (waitResult === "COMPLETED") {
                console.log(
                    `[DatabaseInitializer] Database initialization completed by another instance. Proceeding.`,
                );
                return {
                    initialized: true,
                    waited: true,
                    version,
                    durationMs: Date.now() - startTime,
                };
            }

            if (waitResult === "LOCK_RELEASED") {
                // The lock was released or expired, try acquiring again once
                lockAcquired = await this.lockManager.acquire(runnerId, timeoutMs);
            }

            if (!lockAcquired) {
                throw new AppError(
                    `[DatabaseInitializer] Failed to acquire initialization lock within ${timeoutMs}ms. Aborting startup to prevent uninitialized execution.`,
                    504,
                );
            }
        }

        try {
            console.log(
                `[DatabaseInitializer] Starting database initialization (version: ${version}, runner: ${runnerId})...`,
            );

            // Record PENDING state
            await InitializationStateModel.findOneAndUpdate(
                { version },
                {
                    $set: {
                        name: DatabaseInitializer.INITIALIZATION_NAME,
                        status: InitializationStatus.PENDING,
                        startedAt: new Date(),
                        executedBy: runnerId,
                        error: null,
                    },
                },
                { upsert: true, returnDocument: "after" },
            );

            // Execute seed steps in dependency order
            for (const step of SEED_REGISTRY) {
                console.log(`[DatabaseInitializer] Executing: ${step.name} - ${step.description}...`);
                await step.execute();
            }

            // Verify the initialized database
            console.log(`[DatabaseInitializer] Verifying database initialization...`);
            const verification = await verifyDatabaseInitialization();

            if (!verification.valid) {
                const errorMessage = `Post-initialization verification failed: ${verification.errors.join("; ")}`;
                throw new AppError(errorMessage, 500);
            }

            const durationMs = Date.now() - startTime;

            // Mark COMPLETED
            await InitializationStateModel.findOneAndUpdate(
                { version },
                {
                    $set: {
                        status: InitializationStatus.COMPLETED,
                        completedAt: new Date(),
                        details: verification.details,
                        error: null,
                    },
                },
            );

            console.log(
                `[DatabaseInitializer] Database initialization completed successfully in ${durationMs}ms (version: ${version}).`,
            );

            await this.lockManager.release(runnerId);

            return {
                initialized: true,
                version,
                durationMs,
                details: verification.details,
            };
        } catch (error: any) {
            console.error(`[DatabaseInitializer] Initialization failed:`, error);

            try {
                await InitializationStateModel.findOneAndUpdate(
                    { version },
                    {
                        $set: {
                            status: InitializationStatus.FAILED,
                            error: error?.message || "Unknown initialization failure",
                        },
                    },
                );
            } catch (stateError) {
                console.error("[DatabaseInitializer] Failed to record FAILED status:", stateError);
            }

            try {
                await this.lockManager.release(runnerId);
            } catch (lockError) {
                console.error("[DatabaseInitializer] Failed to release lock on error:", lockError);
            }

            throw error;
        }
    }

    async verify(): Promise<IVerificationResult> {
        return verifyDatabaseInitialization();
    }
}

export async function initializeDatabaseIfRequired(options?: {
    force?: boolean;
}): Promise<IInitializationReport> {
    const initializer = new DatabaseInitializer();
    return initializer.initialize(options);
}
