import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CurrencyMessages } from "../constants/currency.messages.js";
import { CurrencyValidation } from "./currency.validation.js";

export const createCurrencyValidation = (req: Request, res: Response, next: NextFunction) => {

    const {
        name,
        code,
        symbol,
        numericCode,
        decimalPlaces,
        type,
        isActive,
        isDefault,
        isSystem,
    } = req.body;

    if (!name) {
        throw new AppError(
            CurrencyMessages.NAME_REQUIRED,
            400
        );
    }

    if (!code) {
        throw new AppError(
            CurrencyMessages.CODE_REQUIRED,
            400
        );
    }

    if (!CurrencyValidation.codes.includes(code)) {
        throw new AppError(
            CurrencyMessages.INVALID_CODE,
            400
        );
    }

    if (!symbol) {
        throw new AppError(
            CurrencyMessages.SYMBOL_REQUIRED,
            400
        );
    }

    if (!numericCode) {
        throw new AppError(
            CurrencyMessages.NUMERIC_CODE_REQUIRED,
            400
        );
    }

    if (!/^\d{3}$/.test(numericCode)) {
        throw new AppError(
            CurrencyMessages.INVALID_NUMERIC_CODE,
            400
        );
    }

    if (decimalPlaces === undefined) {
        throw new AppError(
            CurrencyMessages.DECIMAL_PLACES_REQUIRED,
            400
        );
    }

    if (typeof decimalPlaces !== "number" || decimalPlaces < 0 || decimalPlaces > 4 || !Number.isInteger(decimalPlaces)) {
        throw new AppError(
            CurrencyMessages.INVALID_DECIMAL_PLACES,
            400
        );
    }

    if (type !== undefined && !CurrencyValidation.types.includes(type)) {
        throw new AppError(
            CurrencyMessages.INVALID_TYPE,
            400
        );
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(
            CurrencyMessages.INVALID_STATUS,
            400
        );
    }

    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(
            CurrencyMessages.INVALID_DEFAULT,
            400
        );
    }

    if (isSystem !== undefined && typeof isSystem !== "boolean") {
        throw new AppError(
            CurrencyMessages.INVALID_SYSTEM,
            400
        );
    }

    next();
};