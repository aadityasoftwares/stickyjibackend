import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { validateId } from "../../../utils/validations/validateId.validation.js";

import { StickyNoteChecklistItemStatus } from "../constants/stickyNoteChecklistItem.enums.js";

import { StickyNoteChecklistItemMessages } from "../constants/stickyNoteChecklistItem.messages.js";

import { StickyNoteChecklistItemValidation } from "./stickyNoteChecklistItem.validation.js";

const ALLOWED_FIELDS = new Set(["status"]);

export const updateStickyNoteChecklistItemStatusValidation = (
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

            if (invalidFields.length > 0 || !StickyNoteChecklistItemValidation.isValidStatus(body.status)) {
                return next(new AppError(StickyNoteChecklistItemMessages.INVALID_STATUS, 400));
            }

            if (body.status === StickyNoteChecklistItemStatus.DELETED) {
                return next(new AppError(StickyNoteChecklistItemMessages.CANNOT_DELETE_THROUGH_STATUS, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
