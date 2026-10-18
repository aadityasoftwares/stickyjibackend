import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PlanFeatureMessages, } from "../constants/planFeature.messages.js";
import { validateId, } from "../../../utils/validations/validateId.validation.js";
import { PlanFeatureValidation } from "./planfeature.validation.js";

export const updatePlanFeatureValidation = (req: Request, res: Response, next: NextFunction) => {

    validateId(req, res, (error?: any) => {

        if (error) {
            return next(error);
        }

        const {
            planId,
            featureId,
            isEnabled,
            limit,
            limitType,
            isUnlimited,
            sortOrder,
        } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(
                new AppError(
                    PlanFeatureMessages.UPDATE_REQUIRED,
                    400
                )
            );
        }

        if (planId === null || planId === "") {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_PLAN,
                    400
                )
            );
        }

        if (featureId === null || featureId === "") {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_FEATURE,
                    400
                )
            );
        }

        if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_STATUS,
                    400
                )
            );
        }

        if (limit !== undefined && (typeof limit !== "number" || limit < 0)) {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_LIMIT,
                    400
                )
            );
        }

        if (limitType !== undefined && !PlanFeatureValidation.limitTypes.includes(limitType)) {

            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_LIMIT_TYPE,
                    400
                )
            );

        }

        // if (isUnlimited !== undefined && typeof isUnlimited !== "boolean") {
        //     return next(
        //         new AppError(
        //             PlanFeatureMessages.INVALID_UNLIMITED,
        //             400
        //         )
        //     );
        // }

        if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_SORT_ORDER,
                    400
                )
            );
        }

        // if (isUnlimited === true && limitType === "NONE") {
        //     return next(
        //         new AppError(
        //             PlanFeatureMessages.INVALID_UNLIMITED,
        //             400
        //         )
        //     );
        // }

        // if (isUnlimited === true && limit !== undefined && limit > 0) {
        //     return next(
        //         new AppError(
        //             PlanFeatureMessages.INVALID_UNLIMITED,
        //             400
        //         )
        //     );
        // }

        if (limitType !== undefined && limitType !== "NONE" && isUnlimited !== true && limit === undefined) {
            return next(
                new AppError(
                    PlanFeatureMessages.INVALID_LIMIT_FEATURE,
                    400
                )
            );
        }
        next();
    });
};
