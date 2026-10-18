import mongoose, { Schema, Model, Document } from "mongoose";

export interface IInitializationLock {
    _id: string;
    locked: boolean;
    lockedBy: string;
    lockedAt: Date;
    expiresAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IInitializationLockDocument extends IInitializationLock, Document<string> {}

const InitializationLockSchema = new Schema<IInitializationLockDocument>(
    {
        _id: {
            type: String,
            required: true,
        },
        locked: {
            type: Boolean,
            required: true,
            default: false,
        },
        lockedBy: {
            type: String,
            required: true,
            default: "",
        },
        lockedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: "initializationlocks",
    }
);

export const InitializationLockModel: Model<IInitializationLockDocument> =
    mongoose.model<IInitializationLockDocument>(
        "InitializationLock",
        InitializationLockSchema
    );

export class InitializationLockManager {
    private readonly lockId: string;
    private heartbeatTimer: NodeJS.Timeout | null = null;

    constructor(lockId = "database_initialization") {
        this.lockId = lockId;
    }

    async acquire(runnerId: string, ttlMs = 60000): Promise<boolean> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        // First attempt: atomic update if lock is free or expired
        const updated = await InitializationLockModel.findOneAndUpdate(
            {
                _id: this.lockId,
                $or: [
                    { locked: false },
                    { expiresAt: { $lt: now } },
                ],
            },
            {
                $set: {
                    locked: true,
                    lockedBy: runnerId,
                    lockedAt: now,
                    expiresAt,
                },
            },
            { returnDocument: "after" }
        );

        if (updated && updated.lockedBy === runnerId) {
            this.startHeartbeat(runnerId, ttlMs);
            return true;
        }

        // Second attempt: if the document didn't exist yet, try creating it
        try {
            await InitializationLockModel.create({
                _id: this.lockId,
                locked: true,
                lockedBy: runnerId,
                lockedAt: now,
                expiresAt,
            });
            this.startHeartbeat(runnerId, ttlMs);
            return true;
        } catch (error: any) {
            // E11000 duplicate key error means another runner inserted it first
            if (error.code === 11000) {
                return false;
            }
            throw error;
        }
    }

    async release(runnerId: string): Promise<boolean> {
        this.stopHeartbeat();
        const result = await InitializationLockModel.findOneAndUpdate(
            { _id: this.lockId, lockedBy: runnerId },
            { $set: { locked: false, expiresAt: new Date(0) } },
            { returnDocument: "after" }
        );
        return !!result;
    }

    async heartbeat(runnerId: string, ttlMs = 60000): Promise<boolean> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);

        const result = await InitializationLockModel.findOneAndUpdate(
            { _id: this.lockId, locked: true, lockedBy: runnerId },
            { $set: { expiresAt } },
            { returnDocument: "after" }
        );
        return !!result;
    }

    private startHeartbeat(runnerId: string, ttlMs: number): void {
        this.stopHeartbeat();
        const interval = Math.max(1000, Math.floor(ttlMs / 3));
        this.heartbeatTimer = setInterval(async () => {
            try {
                await this.heartbeat(runnerId, ttlMs);
            } catch (error) {
                console.error("[InitializationLock] Heartbeat failed:", error);
            }
        }, interval);
        // Do not keep Node process alive just for the lock heartbeat
        if (this.heartbeatTimer.unref) {
            this.heartbeatTimer.unref();
        }
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    async waitForCompletionOrRelease(
        checkCompleted: () => Promise<boolean>,
        maxWaitMs = 60000,
        pollIntervalMs = 1000
    ): Promise<"COMPLETED" | "LOCK_RELEASED" | "TIMEOUT"> {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitMs) {
            if (await checkCompleted()) {
                return "COMPLETED";
            }

            const currentLock = await InitializationLockModel.findById(this.lockId).lean();
            const now = new Date();
            if (!currentLock || !currentLock.locked || currentLock.expiresAt < now) {
                return "LOCK_RELEASED";
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        if (await checkCompleted()) {
            return "COMPLETED";
        }

        return "TIMEOUT";
    }
}
