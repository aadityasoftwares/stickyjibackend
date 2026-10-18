import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const changeFeatureStatusValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        if (typeof req.body.isActive !== "boolean") {
            return next(new AppError(FeatureMessages.INVALID_STATUS, 400));
        }

        next();
    });
};
