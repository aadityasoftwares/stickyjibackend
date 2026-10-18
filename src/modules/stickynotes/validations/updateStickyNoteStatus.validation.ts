import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation } from "./stickyNote.validation.js";
export const updateStickyNoteStatusValidation = (req: Request, res: Response, next: NextFunction): void => {
    validateId(req, res, (error?: unknown) => {
        if (error) return next(error);
        const body: unknown = req.body;
        if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !("status" in body)
        ) {
            return next(new AppError("Only status can be updated from this endpoint.", 400));
        }
        if (!StickyNoteValidation.isValidStatus(body.status))
            return next(new AppError(StickyNoteMessages.INVALID_STATUS, 400));
        next();
    });
};
