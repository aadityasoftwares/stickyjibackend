import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CountryMessages } from "../constants/country.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const changeCountryStatusValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        if (typeof req.body.isActive !== "boolean") {
            return next(new AppError(CountryMessages.INVALID_STATUS, 400));
        }

        next();
    });
};
