import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { LocalizationValidation } from "./localization.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateLocalizationValidation = (req: Request, res: Response, next: NextFunction) => {

    validateId(req, res, (error?: any) => {

        if (error) {
            return next(error);
        }

        const {
            language,
            direction,
            isActive,
            isDefault,
        } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(
                new AppError(
                    LocalizationMessages.UPDATE_REQUIRED,
                    400
                )
            );
        }

        if (language && !LocalizationValidation.languages.includes(language)) {
            return next(
                new AppError(
                    LocalizationMessages.INVALID_LANGUAGE,
                    400
                )
            );
        }

        if (direction && !LocalizationValidation.directions.includes(direction)) {
            return next(
                new AppError(
                    LocalizationMessages.INVALID_DIRECTION,
                    400
                )
            );
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(
                new AppError(
                    LocalizationMessages.INVALID_STATUS,
                    400
                )
            );
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(
                new AppError(
                    LocalizationMessages.INVALID_STATUS,
                    400
                )
            );
        }

        next();
    });
};