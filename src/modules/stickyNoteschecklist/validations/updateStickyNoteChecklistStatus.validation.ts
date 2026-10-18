import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { validateId } from "../../../utils/validations/validateId.validation.js";

import { StickyNoteChecklistStatus } from "../constants/stickyNoteChecklist.enums.js";

import { StickyNoteChecklistMessages } from "../constants/stickyNoteChecklist.messages.js";

import { StickyNoteChecklistValidation } from "./stickyNoteChecklist.validation.js";

const ALLOWED_FIELDS = new Set(["status"]);

export const updateStickyNoteChecklistStatusValidation = (
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

            if (invalidFields.length > 0 || !StickyNoteChecklistValidation.isValidStatus(body.status)) {
                return next(new AppError(StickyNoteChecklistMessages.INVALID_STATUS, 400));
            }

            if (body.status === StickyNoteChecklistStatus.DELETED) {
                return next(new AppError(StickyNoteChecklistMessages.CANNOT_DELETE_THROUGH_STATUS, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
