import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CurrencyMessages } from "../constants/currency.messages.js";
import { CurrencyValidation } from "./currency.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { CurrencyCode } from "../constants/currency.enums.js";

export const getCurrencyValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const code = RequestUtil.getParam(req.params.code);

    if (!code) {
        throw new AppError(CurrencyMessages.CODE_REQUIRED, 400);
    }

    const normalizedCode = code.toUpperCase();

    if (!CurrencyValidation.codes.includes(normalizedCode as CurrencyCode)) {
        throw new AppError(CurrencyMessages.INVALID_CODE, 400);
    }

    next();
};
