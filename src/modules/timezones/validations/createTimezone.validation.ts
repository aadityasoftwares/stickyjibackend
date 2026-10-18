import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { TimezoneMessages } from "../constants/timezone.messages.js";
import { TimezoneValidation } from "./timezone.validation.js";

export const createTimezoneValidation = (req: Request, res: Response, next: NextFunction) => {

    const {
        name,
        code,
        countryCode,
        utcOffset,
        isActive,
        isDefault,
    } = req.body;


    if (!name) {
        throw new AppError(
            TimezoneMessages.NAME_REQUIRED,
            400
        );
    }


    if (!code) {
        throw new AppError(
            TimezoneMessages.CODE_REQUIRED,
            400
        );
    }


    if (!TimezoneValidation.isValidTimezone(code)) {
        throw new AppError(
            TimezoneMessages.INVALID_CODE,
            400
        );
    }


    if (!countryCode) {
        throw new AppError(
            TimezoneMessages.COUNTRY_CODE_REQUIRED,
            400
        );
    }


    if (!TimezoneValidation.countryCodes.includes(countryCode)) {
        throw new AppError(
            TimezoneMessages.INVALID_COUNTRY_CODE,
            400
        );
    }


    if (!TimezoneValidation.isTimezoneAvailableForCountry(
        countryCode,
        code
    )) {
        throw new AppError(
            TimezoneMessages.TIMEZONE_NOT_AVAILABLE_FOR_COUNTRY,
            400
        );
    }


    if (!utcOffset) {
        throw new AppError(
            TimezoneMessages.UTC_OFFSET_REQUIRED,
            400
        );
    }


    if (!TimezoneValidation.isValidUtcOffset(utcOffset)) {
        throw new AppError(
            TimezoneMessages.INVALID_UTC_OFFSET,
            400
        );
    }


    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(
            TimezoneMessages.INVALID_STATUS,
            400
        );
    }


    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(
            TimezoneMessages.INVALID_DEFAULT,
            400
        );
    }


    next();
};