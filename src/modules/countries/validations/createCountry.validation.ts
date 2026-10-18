import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CountryMessages } from "../constants/country.messages.js";
import { CountryValidation } from "./country.validation.js";

export const createCountryValidation = (req: Request, res: Response, next: NextFunction) => {
    const {
        name,
        nativeName,
        code,
        alpha3Code,
        numericCode,
        dialCode,
        continent,
        currencyCode,
        currencySymbol,
        locale,
        isActive,
        isDefault,
        isSystem,
    } = req.body;

    if (!name) {
        throw new AppError(CountryMessages.NAME_REQUIRED, 400);
    }

    if (!nativeName) {
        throw new AppError(CountryMessages.NATIVE_NAME_REQUIRED, 400);
    }

    if (!code) {
        throw new AppError(CountryMessages.CODE_REQUIRED, 400);
    }

    if (!CountryValidation.codes.includes(code)) {
        throw new AppError(CountryMessages.INVALID_CODE, 400);
    }

    if (!alpha3Code) {
        throw new AppError(CountryMessages.ALPHA3_CODE_REQUIRED, 400);
    }

    if (!CountryValidation.alpha3Codes.includes(alpha3Code)) {
        throw new AppError(CountryMessages.INVALID_ALPHA3_CODE, 400);
    }

    if (!numericCode) {
        throw new AppError(CountryMessages.NUMERIC_CODE_REQUIRED, 400);
    }

    if (!CountryValidation.numericCodes.includes(numericCode)) {
        throw new AppError(CountryMessages.INVALID_NUMERIC_CODE, 400);
    }

    if (!dialCode) {
        throw new AppError(CountryMessages.DIAL_CODE_REQUIRED, 400);
    }

    if (!CountryValidation.dialCodes.includes(dialCode)) {
        throw new AppError(CountryMessages.INVALID_DIAL_CODE, 400);
    }

    if (!continent) {
        throw new AppError(CountryMessages.CONTINENT_REQUIRED, 400);
    }

    if (!CountryValidation.continents.includes(continent)) {
        throw new AppError(CountryMessages.INVALID_CONTINENT, 400);
    }

    if (!currencyCode) {
        throw new AppError(CountryMessages.CURRENCY_CODE_REQUIRED, 400);
    }

    if (!CountryValidation.currencyCodes.includes(currencyCode)) {
        throw new AppError(CountryMessages.INVALID_CURRENCY_CODE, 400);
    }

    if (!currencySymbol) {
        throw new AppError(CountryMessages.CURRENCY_SYMBOL_REQUIRED, 400);
    }

    if (!locale) {
        throw new AppError(CountryMessages.LOCALE_REQUIRED, 400);
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(CountryMessages.INVALID_STATUS, 400);
    }

    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(CountryMessages.INVALID_DEFAULT, 400);
    }

    if (isSystem !== undefined && typeof isSystem !== "boolean") {
        throw new AppError(CountryMessages.INVALID_SYSTEM, 400);
    }

    next();
};
