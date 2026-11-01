import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { readFile, writeFile } from "node:fs/promises";
import { MediaModel } from "../modules/media/models/media.model.js";
import { MediaContentService } from "../modules/media/services/mediaContent.service.js";
import { resolveLegacyMediaOwnership } from "../modules/media/services/mediaMigration.service.js";
import { StorageKeyBuilder } from "../modules/media/storage/storageKey.builder.js";
import { CloudflareR2Service } from "../modules/media/storage/cloudflareR2.service.js";
import { MediaSecurity } from "../modules/media/constants/mediaSecurity.constants.js";

const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const apply = args.includes("--apply");
const journalPath = option("--journal");
type Journal = {
    id: string;
    sourceKey: string;
    sourceBucket: string;
    targetKey: string;
    targetBucket: string;
    checksum: string;
    cleanupAfter: string;
    priorVersion: number;
    priorPublicUrl: string | null;
};
try {
    if (
        args.some(
            (arg) =>
                !["--apply", "--dry-run", "--cleanup", "--rollback"].includes(arg) &&
                !/^--(journal|media-id)=.+$/.test(arg),
        ) ||
        (apply && args.includes("--dry-run"))
    )
        throw new Error("Invalid or conflicting migration flags.");
    if (!process.env.MONGO_URI || !journalPath) throw new Error("MONGO_URI and --journal=path are required.");
    if (args.includes("--cleanup") && args.includes("--rollback"))
        throw new Error("Choose cleanup or rollback, not both.");
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
    const storage = new CloudflareR2Service();
    const verifier = new MediaContentService();
    let journal: Journal | undefined;
    try {
        journal = JSON.parse(await readFile(journalPath, "utf8")) as Journal;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const id = journal?.id ?? option("--media-id");
    if (!id || !Types.ObjectId.isValid(id))
        throw new Error("A valid --media-id is required for a new migration.");
    const media = await MediaModel.findById(id).lean().exec();
    if (!media || media.status !== "ACTIVE") throw new Error("Only active media can be migrated.");
    const ownership = await resolveLegacyMediaOwnership(media);
    if (args.includes("--rollback") || args.includes("--cleanup")) {
        if (!journal) throw new Error("Existing journal required.");
        if (media.storageKey !== journal.targetKey || media.bucket !== journal.targetBucket)
            throw new Error("Database no longer references the migration target.");
        if (args.includes("--cleanup")) {
            if (Date.now() < new Date(journal.cleanupAfter).getTime())
                throw new Error("Source retention window has not elapsed.");
            if ((await verifier.verify(storage, media)) !== journal.checksum)
                throw new Error("Target integrity verification failed.");
            if (await MediaModel.exists({ storageKey: journal.sourceKey }))
                throw new Error("Source is still referenced.");
            if (apply) await storage.deleteObject(journal.sourceKey, journal.sourceBucket);
            console.log(JSON.stringify({ id, action: "cleanup-source", applied: apply }));
        } else {
            if (
                (await verifier.verify(storage, {
                    ...media,
                    storageKey: journal.sourceKey,
                    bucket: journal.sourceBucket,
                })) !== journal.checksum
            )
                throw new Error("Source integrity verification failed.");
            if (apply) {
                await MediaModel.collection.updateOne(
                    {
                        _id: media._id,
                        storageKey: journal.targetKey,
                        bucket: journal.targetBucket,
                        status: "ACTIVE",
                    },
                    {
                        $set: {
                            storageKey: journal.sourceKey,
                            bucket: journal.sourceBucket,
                            storageKeyVersion: journal.priorVersion,
                            publicUrl: journal.priorPublicUrl,
                        },
                    },
                );
            }
            console.log(JSON.stringify({ id, action: "rollback-key", applied: apply }));
        }
    } else {
        if (journal && media.storageKey === journal.targetKey) {
            console.log(JSON.stringify({ id, action: "already-migrated" }));
        } else {
            if (journal && (media.storageKey !== journal.sourceKey || media.bucket !== journal.sourceBucket))
                throw new Error("Source changed since migration preparation.");
            if (!journal) {
                const format = MediaSecurity.format(media.mimeType);
                const key = StorageKeyBuilder.build(
                    {
                        accountId: String(ownership.tenantId ?? media.uploadedBy),
                        ...(ownership.workspaceId
                            ? {
                                  tenantId: String(ownership.tenantId),
                                  workspaceId: String(ownership.workspaceId),
                              }
                            : {}),
                        ...(media.resourceType === "NOTE" ? { noteId: String(media.resourceId) } : {}),
                    },
                    media.purpose,
                    format.extension,
                );
                journal = {
                    id,
                    sourceKey: media.storageKey,
                    sourceBucket: media.bucket,
                    targetKey: key,
                    targetBucket: storage.getUploadBucket(
                        media.visibility === "PRIVATE" || Boolean(ownership.workspaceId),
                    ),
                    checksum: "",
                    cleanupAfter: new Date(Date.now() + 7 * 86400000).toISOString(),
                    priorVersion: media.storageKeyVersion ?? 1,
                    priorPublicUrl: media.publicUrl ?? null,
                };
            }
            console.log(
                JSON.stringify({
                    id,
                    action: "copy-verify-switch",
                    applied: apply,
                    sourceRetainedUntil: journal.cleanupAfter,
                }),
            );
            if (apply) {
                const head = await storage.headObject(journal.sourceKey, journal.sourceBucket);
                if (!head.ETag || head.ContentLength !== media.size)
                    throw new Error("Source metadata mismatch.");
                const checksum = await verifier.verify(storage, media);
                if (journal.checksum && journal.checksum !== checksum)
                    throw new Error("Source content changed since preparation.");
                journal.checksum = checksum;
                await writeFile(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
                await storage.copyObject(
                    journal.sourceKey,
                    journal.sourceBucket,
                    journal.targetKey,
                    journal.targetBucket,
                    head.ETag,
                );
                if (
                    (await verifier.verify(storage, {
                        ...media,
                        storageKey: journal.targetKey,
                        bucket: journal.targetBucket,
                    })) !== checksum
                )
                    throw new Error("Copy integrity verification failed.");
                const result = await MediaModel.collection.updateOne(
                    {
                        _id: media._id,
                        storageKey: journal.sourceKey,
                        bucket: journal.sourceBucket,
                        status: "ACTIVE",
                    },
                    {
                        $set: {
                            ...ownership,
                            storageKeyVersion: 2,
                            storageKey: journal.targetKey,
                            bucket: journal.targetBucket,
                            checksum,
                            visibility: ownership.workspaceId ? "PRIVATE" : media.visibility,
                            publicUrl:
                                media.visibility === "PUBLIC" && !ownership.workspaceId
                                    ? storage.getPublicUrl(journal.targetKey)
                                    : null,
                        },
                    },
                );
                if (!result.matchedCount)
                    throw new Error("Database changed; source retained. Reconcile the journal.");
            }
        }
    }
} catch {
    console.error(
        "Media key migration did not complete. Source objects are retained unless explicit cleanup succeeded. Inspect the journal and configuration; no credentials are logged.",
    );
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
