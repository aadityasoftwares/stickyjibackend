import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LanguageMessages } from "../constants/language.messages.js";
import { LanguageValidation } from "./language.validation.js";

export const createLanguageValidation = (req: Request, res: Response, next: NextFunction) => {

    const {
        name,
        nativeName,
        code,
        locale,
        direction,
        isActive,
        isDefault,
    } = req.body;

    if (!name) {
        throw new AppError(
            LanguageMessages.NAME_REQUIRED,
            400
        );
    }

    if (!nativeName) {
        throw new AppError(
            LanguageMessages.NATIVE_NAME_REQUIRED,
            400
        );
    }

    if (!code) {
        throw new AppError(
            LanguageMessages.CODE_REQUIRED,
            400
        );
    }

    if (!LanguageValidation.codes.includes(code)) {
        throw new AppError(
            LanguageMessages.INVALID_CODE,
            400
        );
    }

    if (!locale) {
        throw new AppError(
            LanguageMessages.LOCALE_REQUIRED,
            400
        );
    }

    if (direction !== undefined && !LanguageValidation.directions.includes(direction)) {
        throw new AppError(
            LanguageMessages.INVALID_DIRECTION,
            400
        );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(
            LanguageMessages.INVALID_STATUS,
            400
        );
    }

    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(
            LanguageMessages.INVALID_DEFAULT,
            400
        );
    }

    next();
};