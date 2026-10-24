import mongoose, { type ClientSession } from "mongoose";

/** Check before invoking business logic; discovery errors must not disable transactions. */
export async function supportsMongoTransactions(): Promise<boolean> {
    const database = mongoose.connection.db;
    if (!database) throw new Error("MongoDB is not connected.");
    const hello = await database.admin().command({ hello: 1 });
    return Boolean((hello.setName || hello.msg === "isdbgrid") && hello.logicalSessionTimeoutMinutes != null);
}

/** Standalone writes run once without a transaction. Never replay a failed callback in that mode. */
export async function runMongoTransaction<T>(
    operation: (session?: ClientSession) => Promise<T>,
    options: {
        retryAbortedTransaction?: (error: unknown) => boolean;
        missingResultMessage?: string;
    } = {},
): Promise<T> {
    if (!(await supportsMongoTransactions())) return operation();

    for (let attempt = 0; ; attempt++) {
        const session = await mongoose.startSession();
        try {
            const result = await session.withTransaction(() => operation(session));
            if (result === undefined && options.missingResultMessage) {
                throw new Error(options.missingResultMessage);
            }
            return result as T;
        } catch (error) {
            // The transaction has aborted: preserve the invitation repository's bounded
            // duplicate-key retry, without downgrading to non-transactional writes.
            if (attempt < 2 && options.retryAbortedTransaction?.(error)) continue;
            throw error;
        } finally {
            await session.endSession();
        }
    }
}
