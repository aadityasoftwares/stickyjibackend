import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { validateId } from "../../../utils/validations/validateId.validation.js";

import { StickyNoteChecklistItemMessages } from "../constants/stickyNoteChecklistItem.messages.js";

import { StickyNoteChecklistItemValidation } from "./stickyNoteChecklistItem.validation.js";

const ALLOWED_FIELDS = new Set(["isCompleted"]);

export const updateStickyNoteChecklistItemCompletionValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            const body = req.body ?? {};

            const invalidFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));

            if (
                invalidFields.length > 0 ||
                !StickyNoteChecklistItemValidation.isValidCompletion(body.isCompleted)
            ) {
                return next(new AppError(StickyNoteChecklistItemMessages.INVALID_COMPLETION_STATUS, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
