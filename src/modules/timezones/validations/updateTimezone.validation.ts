import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { TimezoneMessages } from "../constants/timezone.messages.js";
import { TimezoneValidation } from "./timezone.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateTimezoneValidation = (req: Request, res: Response, next: NextFunction) => {

    validateId(req, res, (error?: any) => {

        if (error) {
            return next(error);
        }


        const {
            code,
            countryCode,
            utcOffset,
            isActive,
            isDefault,
        } = req.body;


        if (Object.keys(req.body).length === 0) {
            return next(
                new AppError(
                    TimezoneMessages.UPDATE_REQUIRED,
                    400
                )
            );
        }


        if (code && !TimezoneValidation.isValidTimezone(code)) {
            return next(
                new AppError(
                    TimezoneMessages.INVALID_CODE,
                    400
                )
            );
        }


        if (countryCode && !TimezoneValidation.countryCodes.includes(countryCode)) {
            return next(
                new AppError(
                    TimezoneMessages.INVALID_COUNTRY_CODE,
                    400
                )
            );
        }


        if (code && countryCode && !TimezoneValidation.isTimezoneAvailableForCountry(countryCode, code)) {
            return next(
                new AppError(
                    TimezoneMessages.TIMEZONE_NOT_AVAILABLE_FOR_COUNTRY,
                    400
                )
            );
        }


        if (utcOffset && !TimezoneValidation.isValidUtcOffset(utcOffset)) {
            return next(
                new AppError(
                    TimezoneMessages.INVALID_UTC_OFFSET,
                    400
                )
            );
        }


        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(
                new AppError(
                    TimezoneMessages.INVALID_STATUS,
                    400
                )
            );
        }


        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(
                new AppError(
                    TimezoneMessages.INVALID_DEFAULT,
                    400
                )
            );
        }

        next();
    });
};