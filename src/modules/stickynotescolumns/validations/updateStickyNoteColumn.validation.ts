import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

const ALLOWED_FIELDS = ["name", "color"] as const;

export const updateStickyNoteColumnValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id || !StickyNoteColumnValidation.isValidObjectId(id)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_ID, 400));
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return next(new AppError(StickyNoteColumnMessages.UPDATE_REQUIRED, 400));
        }

        if (!StickyNoteColumnValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        const { name, color } = req.body;

        if (name !== undefined && !StickyNoteColumnValidation.isValidName(name)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_NAME, 400));
        }

        if (color !== undefined && !StickyNoteColumnValidation.isValidColor(color)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_COLOR, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
