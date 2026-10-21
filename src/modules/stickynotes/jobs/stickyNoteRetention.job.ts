import { StickyNoteService } from "../services/stickynote.service.js";
const stickyNoteService = new StickyNoteService();
export const runStickyNoteRetentionCleanup = () => stickyNoteService.purgeExpiredStickyNotes();
