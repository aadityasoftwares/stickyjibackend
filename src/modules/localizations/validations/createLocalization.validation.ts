import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { LocalizationValidation } from "./localization.validation.js";

export const createLocalizationValidation = (req: Request, res: Response, next: NextFunction) => {

    const {
        language,
        languageCode,
        locale,
        direction,
        key,
        value,
        module,
        isActive,
        isDefault,
    } = req.body;

    if (!language) {
        throw new AppError(
            LocalizationMessages.LANGUAGE_REQUIRED,
            400
        );
    }

    if (!LocalizationValidation.languages.includes(language)) {
        throw new AppError(
            LocalizationMessages.INVALID_LANGUAGE,
            400
        );
    }

    if (!languageCode) {
        throw new AppError(
            LocalizationMessages.LANGUAGE_CODE_REQUIRED,
            400
        );
    }

    if (!locale) {
        throw new AppError(
            LocalizationMessages.LOCALE_REQUIRED,
            400
        );
    }

    if (!key) {
        throw new AppError(
            LocalizationMessages.KEY_REQUIRED,
            400
        );
    }

    if (!value) {
        throw new AppError(
            LocalizationMessages.VALUE_REQUIRED,
            400
        );
    }

    if (!module) {
        throw new AppError(
            LocalizationMessages.MODULE_REQUIRED,
            400
        );
    }

    if (direction !== undefined && !LocalizationValidation.directions.includes(direction)) {
        throw new AppError(
            LocalizationMessages.INVALID_DIRECTION,
            400
        );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(
            LocalizationMessages.INVALID_STATUS,
            400
        );
    }

    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(
            LocalizationMessages.INVALID_STATUS,
            400
        );
    }

    next();
};