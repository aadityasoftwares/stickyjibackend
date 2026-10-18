import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LanguageMessages } from "../constants/language.messages.js";
import { LanguageValidation } from "./language.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { LanguageCode } from "../constants/language.enums.js";

export const getLanguageValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const code = RequestUtil.getParam(req.params.code);

    if (!code) {
        throw new AppError(LanguageMessages.CODE_REQUIRED, 400);
    }

    if (!LanguageValidation.codes.includes(code as LanguageCode)) {
        throw new AppError(LanguageMessages.INVALID_CODE, 400);
    }

    next();
};
