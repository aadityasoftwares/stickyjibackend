import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { validateId } from "../../../utils/validations/validateId.validation.js";

import { STICKY_NOTE_CHECKLIST_CONSTANTS } from "../constants/stickyNoteChecklist.constants.js";

import { StickyNoteChecklistMessages } from "../constants/stickyNoteChecklist.messages.js";

import { StickyNoteChecklistValidation } from "./stickyNoteChecklist.validation.js";

const ALLOWED_FIELDS = new Set(["title", "position"]);

export const updateStickyNoteChecklistValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            const body = req.body ?? {};

            if (Object.keys(body).length === 0) {
                return next(new AppError(StickyNoteChecklistMessages.UPDATE_REQUIRED, 400));
            }

            const invalidFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));

            if (invalidFields.length > 0) {
                return next(new AppError(StickyNoteChecklistMessages.INVALID_FIELD, 400));
            }

            const { title, position } = body;

            if (title !== undefined) {
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
            }

            if (position !== undefined && !StickyNoteChecklistValidation.isValidPosition(position)) {
                return next(new AppError(StickyNoteChecklistMessages.INVALID_POSITION, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
