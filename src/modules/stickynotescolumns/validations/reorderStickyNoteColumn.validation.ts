import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

const ALLOWED_FIELDS = new Set(["beforeId", "afterId"]);

export const reorderStickyNoteColumnValidation = (req: Request, _res: Response, next: NextFunction): void => {
    try {
        const { id } = req.params;
        if (!id || !StickyNoteColumnValidation.isValidObjectId(id)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_ID, 400));
        }

        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        for (const key of Object.keys(req.body)) {
            if (!ALLOWED_FIELDS.has(key)) {
                return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
            }
        }

        const { beforeId, afterId } = req.body;

        if (beforeId !== undefined && beforeId !== null) {
            if (!StickyNoteColumnValidation.isValidObjectId(beforeId)) {
                return next(new AppError(StickyNoteColumnMessages.INVALID_BEFORE_ID, 400));
            }
            if (beforeId === id) {
                return next(new AppError(StickyNoteColumnMessages.CANNOT_REORDER_SELF, 400));
            }
        }

        if (afterId !== undefined && afterId !== null) {
            if (!StickyNoteColumnValidation.isValidObjectId(afterId)) {
                return next(new AppError(StickyNoteColumnMessages.INVALID_AFTER_ID, 400));
            }
            if (afterId === id) {
                return next(new AppError(StickyNoteColumnMessages.CANNOT_REORDER_SELF, 400));
            }
        }

        if (beforeId && afterId && beforeId === afterId) {
            return next(new AppError(StickyNoteColumnMessages.IDENTICAL_NEIGHBORS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
