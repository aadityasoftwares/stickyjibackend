import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PlanFeatureMessages } from "../constants/planFeature.messages.js";
import { PlanFeatureValidation } from "./planfeature.validation.js";

export const createPlanFeatureValidation = (req: Request, res: Response, next: NextFunction) => {
    const { planId, featureId, isEnabled, limit, limitType, isUnlimited, sortOrder } = req.body;

    if (!planId) {
        throw new AppError(PlanFeatureMessages.PLAN_REQUIRED, 400);
    }

    if (!featureId) {
        throw new AppError(PlanFeatureMessages.FEATURE_REQUIRED, 400);
    }

    if (!limitType) {
        throw new AppError(PlanFeatureMessages.LIMIT_TYPE_REQUIRED, 400);
    }

    if (!PlanFeatureValidation.limitTypes.includes(limitType)) {
        throw new AppError(PlanFeatureMessages.INVALID_LIMIT_TYPE, 400);
    }

    if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
        throw new AppError(PlanFeatureMessages.INVALID_STATUS, 400);
    }

    if (limit !== undefined && (typeof limit !== "number" || limit < 0)) {
        throw new AppError(PlanFeatureMessages.INVALID_LIMIT, 400);
    }

    if (isUnlimited !== undefined && typeof isUnlimited !== "boolean") {
        console.log(isUnlimited);
        throw new AppError(PlanFeatureMessages.INVALID_UNLIMITED, 400);
    }

    if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) {
        throw new AppError(PlanFeatureMessages.INVALID_SORT_ORDER, 400);
    }

    if (limitType !== "NONE" && isUnlimited !== true && (limit === undefined || limit === null)) {
        throw new AppError(PlanFeatureMessages.INVALID_LIMIT_FEATURE, 400);
    }

    next();
};
