import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CurrencyMessages } from "../constants/currency.messages.js";
import { CurrencyValidation } from "./currency.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateCurrencyValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const { code, numericCode, decimalPlaces, type, isActive, isDefault, isSystem } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(CurrencyMessages.UPDATE_REQUIRED, 400));
        }

        if (code && !CurrencyValidation.codes.includes(code)) {
            return next(new AppError(CurrencyMessages.INVALID_CODE, 400));
        }

        if (numericCode && !/^\d{3}$/.test(numericCode)) {
            return next(new AppError(CurrencyMessages.INVALID_NUMERIC_CODE, 400));
        }

        if (
            decimalPlaces !== undefined &&
            (typeof decimalPlaces !== "number" ||
                decimalPlaces < 0 ||
                decimalPlaces > 4 ||
                !Number.isInteger(decimalPlaces))
        ) {
            return next(new AppError(CurrencyMessages.INVALID_DECIMAL_PLACES, 400));
        }

        if (type && !CurrencyValidation.types.includes(type)) {
            return next(new AppError(CurrencyMessages.INVALID_TYPE, 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(CurrencyMessages.INVALID_STATUS, 400));
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(new AppError(CurrencyMessages.INVALID_DEFAULT, 400));
        }

        if (isSystem !== undefined && typeof isSystem !== "boolean") {
            return next(new AppError(CurrencyMessages.INVALID_SYSTEM, 400));
        }

        next();
    });
};
