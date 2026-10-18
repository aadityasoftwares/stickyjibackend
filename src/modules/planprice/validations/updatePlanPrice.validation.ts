import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { PlanPriceMessages } from "../constants/planPrice.messages.js";

import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updatePlanPriceValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        try {
            if (!req.body || Object.keys(req.body).length === 0) {
                throw new AppError(PlanPriceMessages.UPDATE_REQUIRED, 400);
            }

            const forbiddenFields = ["planId", "currencyId", "billingInterval"];

            const hasImmutableField = forbiddenFields.some((field) => req.body[field] !== undefined);

            if (hasImmutableField) {
                throw new AppError(PlanPriceMessages.IMMUTABLE_FIELD, 400);
            }

            const { amountMinor, sortOrder } = req.body;

            if (
                amountMinor !== undefined &&
                (typeof amountMinor !== "number" || amountMinor <= 0 || !Number.isInteger(amountMinor))
            ) {
                throw new AppError(PlanPriceMessages.INVALID_AMOUNT, 400);
            }

            if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) {
                throw new AppError(PlanPriceMessages.INVALID_SORT_ORDER, 400);
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
