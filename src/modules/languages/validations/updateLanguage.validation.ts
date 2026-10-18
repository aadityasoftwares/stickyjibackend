import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LanguageMessages } from "../constants/language.messages.js";
import { LanguageValidation } from "./language.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateLanguageValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const { code, direction, isActive, isDefault } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(LanguageMessages.UPDATE_REQUIRED, 400));
        }

        if (code && !LanguageValidation.codes.includes(code)) {
            return next(new AppError(LanguageMessages.INVALID_CODE, 400));
        }

        if (direction && !LanguageValidation.directions.includes(direction)) {
            return next(new AppError(LanguageMessages.INVALID_DIRECTION, 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(LanguageMessages.INVALID_STATUS, 400));
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(new AppError(LanguageMessages.INVALID_DEFAULT, 400));
        }

        next();
    });
};
