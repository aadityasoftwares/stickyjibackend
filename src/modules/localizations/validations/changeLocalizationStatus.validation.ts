import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const changeLocalizationStatusValidation = (req: Request, res: Response, next: NextFunction) => {

    validateId(req, res, (error?: any) => {

        if (error) {
            return next(error);
        }

        if (typeof req.body.isActive !== "boolean") {
            return next(
                new AppError(
                    LocalizationMessages.INVALID_STATUS,
                    400
                )
            );
        }

        next();
    }
    );
};