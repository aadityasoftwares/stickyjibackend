import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CountryMessages } from "../constants/country.messages.js";
import { CountryValidation } from "./country.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateCountryValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const {
            code,
            alpha3Code,
            numericCode,
            dialCode,
            continent,
            currencyCode,
            isActive,
            isDefault,
            isSystem,
        } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(CountryMessages.UPDATE_REQUIRED, 400));
        }

        if (code && !CountryValidation.codes.includes(code)) {
            return next(new AppError(CountryMessages.INVALID_CODE, 400));
        }

        if (alpha3Code && !CountryValidation.alpha3Codes.includes(alpha3Code)) {
            return next(new AppError(CountryMessages.INVALID_ALPHA3_CODE, 400));
        }

        if (numericCode && !CountryValidation.numericCodes.includes(numericCode)) {
            return next(new AppError(CountryMessages.INVALID_NUMERIC_CODE, 400));
        }

        if (dialCode && !CountryValidation.dialCodes.includes(dialCode)) {
            return next(new AppError(CountryMessages.INVALID_DIAL_CODE, 400));
        }

        if (continent && !CountryValidation.continents.includes(continent)) {
            return next(new AppError(CountryMessages.INVALID_CONTINENT, 400));
        }

        if (currencyCode && !CountryValidation.currencyCodes.includes(currencyCode)) {
            return next(new AppError(CountryMessages.INVALID_CURRENCY_CODE, 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(CountryMessages.INVALID_STATUS, 400));
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(new AppError(CountryMessages.INVALID_DEFAULT, 400));
        }

        if (isSystem !== undefined && typeof isSystem !== "boolean") {
            return next(new AppError(CountryMessages.INVALID_SYSTEM, 400));
        }

        next();
    });
};
