import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { FeatureValidation } from "./feature.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { FeatureCode } from "../constants/feature.enums.js";


export const getFeatureValidation = (req: Request, res: Response, next: NextFunction) => {

    if (req.params.id) {
        return validateId(req, res, next);
    }

    const code = RequestUtil.getParam(req.params.code);

    if (!code) {
        throw new AppError(
            FeatureMessages.CODE_REQUIRED,
            400
        );
    }

    const normalizedCode = code.toUpperCase();

    if (!FeatureValidation.codes.includes(normalizedCode as FeatureCode)) {
        throw new AppError(
            FeatureMessages.INVALID_CODE,
            400
        );
    }

    next();
};