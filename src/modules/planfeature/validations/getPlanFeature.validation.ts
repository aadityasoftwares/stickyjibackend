import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PlanFeatureMessages, } from "../constants/planFeature.messages.js";
import { validateId, } from "../../../utils/validations/validateId.validation.js";
import mongoose from "mongoose";

export const getPlanFeatureValidation = (req: Request, res: Response, next: NextFunction) => {

    if (req.params.planId || req.params.featureId) {

        const {
            planId,
            featureId,
        }: any = req.params;

        if (!planId) {
            throw new AppError(
                PlanFeatureMessages.PLAN_REQUIRED,
                400
            );
        }

        if (!featureId) {
            throw new AppError(
                PlanFeatureMessages.FEATURE_REQUIRED,
                400
            );
        }

        if (!mongoose.Types.ObjectId.isValid(planId)) {
            throw new AppError(
                PlanFeatureMessages.INVALID_PLAN,
                400
            );
        }

        if (!mongoose.Types.ObjectId.isValid(featureId)) {
            throw new AppError(
                PlanFeatureMessages.INVALID_FEATURE,
                400
            );
        }

        return next();
    }

    if (req.params.id) {
        return validateId(req, res, next);
    }

    throw new AppError(
        PlanFeatureMessages.ID_REQUIRED,
        400
    );
};