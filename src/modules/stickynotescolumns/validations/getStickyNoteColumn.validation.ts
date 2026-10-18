import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

export const getStickyNoteColumnValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        if (!id || !StickyNoteColumnValidation.isValidObjectId(id)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_ID, 400));
        }
        next();
    } catch (error) {
        next(error);
    }
};
