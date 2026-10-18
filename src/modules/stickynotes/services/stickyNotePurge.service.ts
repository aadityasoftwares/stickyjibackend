import { Types } from "mongoose";
import { StickyNoteStatus } from "../constants/stickyNote.enums.js";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { StickyNoteRepository } from "../repositories/stickyNote.repository.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type { IStickyNotePurgeResult } from "../interfaces/stickyNote.interface.js";
export type { IStickyNotePurgeResult } from "../interfaces/stickyNote.interface.js";
export class StickyNotePurgeService {
    private readonly repository = new StickyNoteRepository();
    async purgeById(stickyNoteId: string): Promise<IStickyNotePurgeResult> {
        if (!Types.ObjectId.isValid(stickyNoteId)) throw new AppError(StickyNoteMessages.NOT_FOUND, 404);
        return this.repository.runInTransaction(async (session) => {
            const note = await this.repository.findPurgeCandidate(stickyNoteId, session);
            if (!note) throw new AppError(StickyNoteMessages.NOT_FOUND, 404);
            if (note.status !== StickyNoteStatus.TRASHED) {
                throw new AppError(StickyNoteMessages.PERMANENT_DELETE_REQUIRES_TRASH, 400);
            }
            const result = await this.repository.deleteDependentData(stickyNoteId, session);
            if (result.deletedStickyNotes !== 1) throw new AppError(StickyNoteMessages.NOT_FOUND, 404);
            return result;
        });
    }
}
