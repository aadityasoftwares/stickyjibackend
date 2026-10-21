import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { StickyNoteModel } from "../modules/stickynotes/models/stickynote.model.js";
import { StickyNoteColumnModel } from "../modules/stickynotescolumns/models/stickyNoteColumn.model.js";
import { RankUtil } from "../utils/rank.util.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mystickynotes";

export async function backfillColumns(): Promise<{
    foldersProcessed: number;
    columnsProcessed: number;
    columnsUpdated: number;
}> {
    console.log("\n--- Backfilling Sticky Note Columns ---");

    // Find all distinct folder scopes that have columns
    const columnsWithMissingRank = await StickyNoteColumnModel.find({
        $or: [{ rank: { $exists: false } }, { rank: null }, { rank: "" }],
    })
        .select({
            workspaceId: 1,
            workspaceFolderId: 1,
        })
        .lean()
        .exec();

    if (columnsWithMissingRank.length === 0) {
        console.log("All sticky note columns already have valid ranks. Nothing to update.");
        return {
            foldersProcessed: 0,
            columnsProcessed: 0,
            columnsUpdated: 0,
        };
    }

    // Collect unique workspace + folder pairs
    const folderMap = new Map<string, { workspaceId: Types.ObjectId; workspaceFolderId: Types.ObjectId }>();
    for (const col of columnsWithMissingRank) {
        const key = `${col.workspaceId.toString()}_${col.workspaceFolderId.toString()}`;
        if (!folderMap.has(key)) {
            folderMap.set(key, {
                workspaceId: col.workspaceId,
                workspaceFolderId: col.workspaceFolderId,
            });
        }
    }

    let totalColumnsProcessed = 0;
    let totalColumnsUpdated = 0;

    for (const [, { workspaceId, workspaceFolderId }] of folderMap) {
        const columns = await StickyNoteColumnModel.find({
            workspaceId,
            workspaceFolderId,
        })
            .sort({
                position: 1,
                createdAt: 1,
                _id: 1,
            })
            .select({
                _id: 1,
                rank: 1,
                position: 1,
            })
            .exec();

        totalColumnsProcessed += columns.length;
        const sequentialRanks = RankUtil.generateNSequentialRanks(columns.length);
        const operations: mongoose.AnyBulkWriteOperation[] = [];

        columns.forEach((column, index) => {
            const desiredRank = sequentialRanks[index];
            if (!column.rank || column.rank !== desiredRank) {
                operations.push({
                    updateOne: {
                        filter: { _id: column._id },
                        update: { $set: { rank: desiredRank } },
                    },
                });
            }
        });

        if (operations.length > 0) {
            const result = await StickyNoteColumnModel.bulkWrite(operations, {
                ordered: true,
            });
            totalColumnsUpdated += result.modifiedCount;
        }
    }

    console.log(`Folders processed: ${folderMap.size}`);
    console.log(`Columns processed: ${totalColumnsProcessed}`);
    console.log(`Columns updated: ${totalColumnsUpdated}`);

    return {
        foldersProcessed: folderMap.size,
        columnsProcessed: totalColumnsProcessed,
        columnsUpdated: totalColumnsUpdated,
    };
}

export async function backfillStickyNotes(): Promise<{
    groupsProcessed: number;
    notesProcessed: number;
    notesUpdated: number;
}> {
    console.log("\n--- Backfilling Sticky Notes ---");

    // Find all notes missing rank
    const notesWithMissingRank = await StickyNoteModel.find({
        $or: [{ rank: { $exists: false } }, { rank: null }, { rank: "" }],
    })
        .select({
            workspaceId: 1,
            columnId: 1,
        })
        .lean()
        .exec();

    if (notesWithMissingRank.length === 0) {
        console.log("All sticky notes already have valid ranks. Nothing to update.");
        return {
            groupsProcessed: 0,
            notesProcessed: 0,
            notesUpdated: 0,
        };
    }

    // Collect unique workspaceId + columnId pairs
    const groupMap = new Map<string, { workspaceId: Types.ObjectId; columnId: Types.ObjectId }>();
    for (const note of notesWithMissingRank) {
        const key = `${note.workspaceId.toString()}_${note.columnId.toString()}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                workspaceId: note.workspaceId,
                columnId: note.columnId,
            });
        }
    }

    let totalNotesProcessed = 0;
    let totalNotesUpdated = 0;

    for (const [, { workspaceId, columnId }] of groupMap) {
        const notes = await StickyNoteModel.find({
            workspaceId,
            columnId,
        })
            .sort({
                position: 1,
                createdAt: 1,
                _id: 1,
            })
            .select({
                _id: 1,
                rank: 1,
                position: 1,
            })
            .exec();

        totalNotesProcessed += notes.length;
        const sequentialRanks = RankUtil.generateNSequentialRanks(notes.length);
        const operations: mongoose.AnyBulkWriteOperation[] = [];

        notes.forEach((note, index) => {
            const desiredRank = sequentialRanks[index];
            if (!note.rank || note.rank !== desiredRank) {
                operations.push({
                    updateOne: {
                        filter: { _id: note._id },
                        update: { $set: { rank: desiredRank } },
                    },
                });
            }
        });

        if (operations.length > 0) {
            const result = await StickyNoteModel.bulkWrite(operations, {
                ordered: true,
            });
            totalNotesUpdated += result.modifiedCount;
        }
    }

    console.log(`Column groups processed: ${groupMap.size}`);
    console.log(`Notes processed: ${totalNotesProcessed}`);
    console.log(`Notes updated: ${totalNotesUpdated}`);

    return {
        groupsProcessed: groupMap.size,
        notesProcessed: totalNotesProcessed,
        notesUpdated: totalNotesUpdated,
    };
}

async function run(): Promise<void> {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.");

        await backfillColumns();
        await backfillStickyNotes();

        console.log("\nBackfill migration completed successfully.");
    } catch (error) {
        console.error("Backfill migration failed:", error);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
}

// Run directly if invoked as entrypoint
if (
    import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/") ||
    process.argv[1]?.endsWith("backfillRanks.ts")
) {
    run();
}
