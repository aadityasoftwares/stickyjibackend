import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { SystemSettingMessages } from "../constants/systemSetting.messages.js";
import { SystemSettingValidation } from "./systemSetting.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";

export const getSystemSettingValidation = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const key = RequestUtil.getParam(req.params.key);

    if (!key) {
        return next(
            new AppError(SystemSettingMessages.KEY_REQUIRED, 400)
        );
    }

    const normalizedKey = key.toUpperCase().trim();

    if (!SystemSettingValidation.keys.includes(normalizedKey as any)) {
        return next(
            new AppError(SystemSettingMessages.INVALID_KEY, 400)
        );
    }

    next();
};