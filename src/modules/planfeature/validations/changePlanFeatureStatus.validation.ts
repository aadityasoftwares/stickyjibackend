import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PlanFeatureMessages, } from "../constants/planFeature.messages.js";
import { validateId, } from "../../../utils/validations/validateId.validation.js";

export const changePlanFeatureStatusValidation = (req: Request, res: Response, next: NextFunction) => {

    validateId(req, res, (error?: any) => {

        if (error) {
            return next(error);
        }

        if (typeof req.body.isEnabled !== "boolean") {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_STATUS,
                    400
                )
            );
        }
        next();
    });
};
