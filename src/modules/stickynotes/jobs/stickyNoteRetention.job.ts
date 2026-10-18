import { StickyNoteService } from "../services/stickyNote.service.js";
const stickyNoteService = new StickyNoteService();
export const runStickyNoteRetentionCleanup = () =>
  stickyNoteService.purgeExpiredStickyNotes();
