import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { TimezoneMessages } from "../constants/timezone.messages.js";
import { TimezoneValidation } from "./timezone.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const getTimezoneValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const code = req.query.code as string;

    if (!code) {
        throw new AppError(TimezoneMessages.CODE_REQUIRED, 400);
    }

    if (!TimezoneValidation.isValidTimezone(code)) {
        throw new AppError(TimezoneMessages.INVALID_CODE, 400);
    }

    next();
};
