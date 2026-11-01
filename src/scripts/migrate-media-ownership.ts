import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { appendFile, readFile } from "node:fs/promises";
import { MediaModel } from "../modules/media/models/media.model.js";
import { resolveLegacyMediaOwnership } from "../modules/media/services/mediaMigration.service.js";

type Scope = { tenantId: string | null; workspaceId: string | null; storageKeyVersion: number };
type Entry = { id: string; storageKey: string; before: Scope; after: Scope };
const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const apply = args.includes("--apply");
const rollback = option("--rollback");
const journal = option("--journal");
const after = option("--after");
const scope = (row: { tenantId?: unknown; workspaceId?: unknown; storageKeyVersion?: number }): Scope => ({
    tenantId: row.tenantId ? String(row.tenantId) : null,
    workspaceId: row.workspaceId ? String(row.workspaceId) : null,
    storageKeyVersion: row.storageKeyVersion ?? 1,
});
const bson = (value: Scope) => ({
    tenantId: value.tenantId ? new Types.ObjectId(value.tenantId) : null,
    workspaceId: value.workspaceId ? new Types.ObjectId(value.workspaceId) : null,
    storageKeyVersion: value.storageKeyVersion,
});

try {
    if (
        args.some(
            (arg) => !["--apply", "--dry-run"].includes(arg) && !/^--(journal|rollback|after)=.+$/.test(arg),
        ) ||
        (apply && args.includes("--dry-run"))
    )
        throw new Error("Invalid or conflicting migration flags.");
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
    if (apply && !journal && !rollback) throw new Error("--apply requires --journal=path for rollback");
    if (after && !Types.ObjectId.isValid(after)) throw new Error("Invalid --after checkpoint");
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    if (rollback) {
        const entries = (await readFile(rollback, "utf8"))
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line) as Entry);
        for (const entry of entries.reverse()) {
            const filter = {
                _id: new Types.ObjectId(entry.id),
                storageKey: entry.storageKey,
                ...bson(entry.after),
            };
            const result = apply
                ? await MediaModel.collection.updateOne(filter, { $set: bson(entry.before) })
                : null;
            console.log(
                JSON.stringify({
                    id: entry.id,
                    action: "rollback",
                    applied: apply,
                    matched: result?.matchedCount,
                }),
            );
        }
    } else {
        const cursor = MediaModel.find(after ? { _id: { $gt: new Types.ObjectId(after) } } : {})
            .sort({ _id: 1 })
            .lean()
            .cursor({ batchSize: 100 });
        let failures = 0;
        for await (const media of cursor) {
            try {
                const before = scope(media);
                const resolved = await resolveLegacyMediaOwnership(media);
                const next = scope(resolved);
                if (JSON.stringify(before) === JSON.stringify(next) && media.storageKeyVersion !== undefined)
                    continue;
                const entry: Entry = {
                    id: String(media._id),
                    storageKey: media.storageKey,
                    before,
                    after: next,
                };
                if (apply) {
                    await appendFile(journal!, JSON.stringify(entry) + "\n", {
                        encoding: "utf8",
                        mode: 0o600,
                    });
                    // Deliberately use the raw collection for immutable ownership backfill, guarded by prior values.
                    const result = await MediaModel.collection.updateOne(
                        {
                            _id: media._id,
                            storageKey: media.storageKey,
                            tenantId: before.tenantId ? new Types.ObjectId(before.tenantId) : null,
                            workspaceId: before.workspaceId ? new Types.ObjectId(before.workspaceId) : null,
                        },
                        { $set: bson(next) },
                    );
                    if (!result.matchedCount) throw new Error("Concurrent change; rerun audit");
                }
                console.log(
                    JSON.stringify({
                        id: entry.id,
                        action: apply ? "backfilled" : "would-backfill",
                        scope: next,
                        legacyKey: !/^(tenants|accounts)\//.test(media.storageKey),
                    }),
                );
            } catch (error) {
                failures++;
                console.error(
                    JSON.stringify({
                        id: String(media._id),
                        action: "reconciliation-required",
                        reason: error instanceof Error ? error.message : "Unknown conflict",
                    }),
                );
            }
        }
        if (failures) process.exitCode = 1;
    }
} catch (error) {
    console.error(
        error instanceof Error && !error.message.includes("mongodb")
            ? error.message
            : "Media migration failed; inspect database connectivity.",
    );
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
