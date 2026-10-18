import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PlanMessages } from "../constants/plan.messages.js";
import { PlanValidation } from "./plan.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";

export const getPlanValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id || req.query.id) {
        if (!req.params.id && req.query.id) {
            req.params.id = String(req.query.id);
        }
        return validateId(req, res, next);
    }

    const code = RequestUtil.getParam(req.params.code || (req.query.code as string));
    if (!code) {
        return next(new AppError(PlanMessages.CODE_REQUIRED, 400));
    }

    const normalizedCode = PlanValidation.normalizeCode(code);
    if (!PlanValidation.isValidCode(normalizedCode)) {
        return next(new AppError(PlanMessages.INVALID_CODE, 400));
    }

    req.params.code = normalizedCode;
    next();
};