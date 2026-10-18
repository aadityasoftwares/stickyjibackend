import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";

export const getLocalizationValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const locale = RequestUtil.getParam(req.params.locale);

    const key = RequestUtil.getParam(req.params.key);

    if (!locale) {
        throw new AppError(LocalizationMessages.LOCALE_REQUIRED, 400);
    }

    if (!key) {
        throw new AppError(LocalizationMessages.KEY_REQUIRED, 400);
    }

    next();
};
