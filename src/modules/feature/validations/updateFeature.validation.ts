import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { FeatureValidation } from "./feature.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateFeatureValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const { code, category, type, isActive, isDefault, isSystem } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(FeatureMessages.UPDATE_REQUIRED, 400));
        }

        if (code && !FeatureValidation.codes.includes(code)) {
            return next(new AppError(FeatureMessages.INVALID_CODE, 400));
        }

        if (category && !FeatureValidation.categories.includes(category)) {
            return next(new AppError(FeatureMessages.INVALID_CATEGORY, 400));
        }

        if (type && !FeatureValidation.types.includes(type)) {
            return next(new AppError(FeatureMessages.INVALID_TYPE, 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(FeatureMessages.INVALID_STATUS, 400));
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(new AppError(FeatureMessages.INVALID_DEFAULT, 400));
        }

        if (isSystem !== undefined && typeof isSystem !== "boolean") {
            return next(new AppError(FeatureMessages.INVALID_SYSTEM, 400));
        }
        next();
    });
};
