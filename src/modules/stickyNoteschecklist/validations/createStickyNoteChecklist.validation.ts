import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { STICKY_NOTE_CHECKLIST_CONSTANTS } from "../constants/stickyNoteChecklist.constants.js";

import { StickyNoteChecklistMessages } from "../constants/stickyNoteChecklist.messages.js";

import { StickyNoteChecklistValidation } from "./stickyNoteChecklist.validation.js";

const ALLOWED_FIELDS = new Set(["stickyNoteId", "title", "position"]);

export const createStickyNoteChecklistValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const invalidFields = Object.keys(req.body ?? {}).filter((field) => !ALLOWED_FIELDS.has(field));

        if (invalidFields.length > 0) {
            return next(new AppError(StickyNoteChecklistMessages.INVALID_FIELD, 400));
        }

        const { stickyNoteId, title, position } = req.body ?? {};

        if (stickyNoteId === undefined || stickyNoteId === null) {
            return next(new AppError(StickyNoteChecklistMessages.STICKY_NOTE_ID_REQUIRED, 400));
        }

        if (!StickyNoteChecklistValidation.isValidObjectId(stickyNoteId)) {
            return next(new AppError(StickyNoteChecklistMessages.INVALID_STICKY_NOTE_ID, 400));
        }

        if (title === undefined || title === null) {
            return next(new AppError(StickyNoteChecklistMessages.TITLE_REQUIRED, 400));
        }

        if (typeof title !== "string") {
            return next(new AppError(StickyNoteChecklistMessages.INVALID_TITLE, 400));
        }

        const normalizedTitle = StickyNoteChecklistValidation.normalizeTitle(title);

        if (
            normalizedTitle.length < STICKY_NOTE_CHECKLIST_CONSTANTS.TITLE.MIN_LENGTH ||
            normalizedTitle.length > STICKY_NOTE_CHECKLIST_CONSTANTS.TITLE.MAX_LENGTH
        ) {
            return next(new AppError(StickyNoteChecklistMessages.INVALID_TITLE, 400));
        }

        if (position !== undefined && !StickyNoteChecklistValidation.isValidPosition(position)) {
            return next(new AppError(StickyNoteChecklistMessages.INVALID_POSITION, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
