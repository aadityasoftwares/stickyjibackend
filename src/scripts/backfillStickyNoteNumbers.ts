import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import { StickyNoteModel } from "../modules/stickynotes/models/stickyNote.model.js";
import { CounterModel } from "../modules/stickynotes/models/counter.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mystickynotes";

export async function backfillStickyNoteNumbers(): Promise<{
    workspacesProcessed: number;
    notesProcessed: number;
    notesUpdated: number;
}> {
    console.log("\n--- Backfilling Sticky Note Numbers ---");

    const notesWithoutNumber = await StickyNoteModel.find({
        $or: [{ stickyNoteNumber: { $exists: false } }, { stickyNoteNumber: null }],
    })
        .select({
            _id: 1,
            workspaceId: 1,
            createdAt: 1,
        })
        .sort({ createdAt: 1, _id: 1 })
        .lean()
        .exec();

    if (notesWithoutNumber.length === 0) {
        console.log("All sticky notes already have valid stickyNoteNumber values. Nothing to update.");
        return {
            workspacesProcessed: 0,
            notesProcessed: 0,
            notesUpdated: 0,
        };
    }

    // Group notes by workspaceId
    const workspaceMap = new Map<string, Array<{ _id: Types.ObjectId; createdAt?: Date }>>();
    for (const note of notesWithoutNumber) {
        const wsKey = note.workspaceId.toString();
        if (!workspaceMap.has(wsKey)) {
            workspaceMap.set(wsKey, []);
        }
        workspaceMap.get(wsKey)!.push({
            _id: note._id as Types.ObjectId,
            createdAt: note.createdAt,
        });
    }

    let totalNotesProcessed = 0;
    let totalNotesUpdated = 0;

    for (const [workspaceIdStr, notes] of workspaceMap.entries()) {
        const workspaceId = new Types.ObjectId(workspaceIdStr);

        // Find the current max stickyNoteNumber in this workspace if any exist
        const highestNote = await StickyNoteModel.findOne({
            workspaceId,
            stickyNoteNumber: { $exists: true, $ne: null },
        })
            .sort({ stickyNoteNumber: -1 })
            .select("stickyNoteNumber")
            .lean()
            .exec();

        // Check if there is an existing counter
        const existingCounter = await CounterModel.findOne({
            workspaceId,
            key: "STICKY_NOTE",
        }).lean();

        let currentSequence = Math.max(highestNote?.stickyNoteNumber ?? 0, existingCounter?.sequence ?? 0);

        console.log(
            `Workspace ${workspaceIdStr}: starting sequence at ${currentSequence} for ${notes.length} unnumbered notes.`,
        );

        const operations = [];
        for (const note of notes) {
            currentSequence += 1;
            totalNotesProcessed += 1;
            operations.push({
                updateOne: {
                    filter: { _id: note._id },
                    update: { $set: { stickyNoteNumber: currentSequence } },
                },
            });
        }

        if (operations.length > 0) {
            const result = await StickyNoteModel.collection.bulkWrite(operations as any, { ordered: true });
            totalNotesUpdated += result.modifiedCount;

            // Update or initialize counter
            await CounterModel.findOneAndUpdate(
                {
                    workspaceId,
                    key: "STICKY_NOTE",
                },
                {
                    $set: { sequence: currentSequence },
                },
                {
                    upsert: true,
                    returnDocument: "after",
                },
            );

            console.log(
                `Workspace ${workspaceIdStr}: updated ${result.modifiedCount} notes. Counter set to ${currentSequence}.`,
            );
        }
    }

    console.log(`Workspaces processed: ${workspaceMap.size}`);
    console.log(`Notes processed: ${totalNotesProcessed}`);
    console.log(`Notes updated: ${totalNotesUpdated}`);

    return {
        workspacesProcessed: workspaceMap.size,
        notesProcessed: totalNotesProcessed,
        notesUpdated: totalNotesUpdated,
    };
}

async function run(): Promise<void> {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("Connected successfully.");

        await backfillStickyNoteNumbers();

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
    process.argv[1]?.endsWith("backfillStickyNoteNumbers.ts")
) {
    run();
}
