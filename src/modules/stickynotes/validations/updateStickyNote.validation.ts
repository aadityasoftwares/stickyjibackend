import type { NextFunction, Request, Response } from "express";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { validateStickyNoteFields } from "./stickyNoteFields.validation.js";
export const updateStickyNoteValidation = (req: Request, res: Response, next: NextFunction): void => {
    validateId(req, res, (error?: unknown) => {
        if (error) return next(error);
        try {
            validateStickyNoteFields(req.body, "update");
            next();
        } catch (error) {
            next(error);
        }
    });
};
