import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PLAN_CONSTANTS } from "../constants/plan.constants.js";
import { PlanMessages } from "../constants/plan.messages.js";
import { PlanValidation } from "./plan.validation.js";

const ALLOWED_FIELDS = [
    "name",
    "code",
    "description",
    "type",
    "pricingModel",
    "trialDays",
    "visibility",
    "isPopular",
    "sortOrder",
    "isDefault",
    "isSystem",
    "isActive",
] as const;

export const createPlanValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(PlanMessages.UNSUPPORTED_FIELDS, 400));
        }

        if (!PlanValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
            return next(new AppError(PlanMessages.UNSUPPORTED_FIELDS, 400));
        }

        const {
            name,
            code,
            description,
            type,
            pricingModel,
            trialDays,
            visibility,
            isPopular,
            sortOrder,
            isDefault,
            isSystem,
            isActive,
        } = req.body;

        if (name === undefined || name === null || typeof name !== "string" || !name.trim()) {
            return next(new AppError(PlanMessages.NAME_REQUIRED, 400));
        }

        const normalizedName = PlanValidation.normalizeName(name);
        if (
            normalizedName.length < PLAN_CONSTANTS.NAME.MIN_LENGTH ||
            normalizedName.length > PLAN_CONSTANTS.NAME.MAX_LENGTH
        ) {
            return next(new AppError(PlanMessages.INVALID_NAME, 400));
        }
        req.body.name = normalizedName;

        if (code === undefined || code === null || typeof code !== "string" || !code.trim()) {
            return next(new AppError(PlanMessages.CODE_REQUIRED, 400));
        }

        const normalizedCode = PlanValidation.normalizeCode(code);
        if (!PlanValidation.isValidCode(normalizedCode)) {
            return next(new AppError(PlanMessages.INVALID_CODE, 400));
        }
        req.body.code = normalizedCode;

        if (
            description === undefined ||
            description === null ||
            typeof description !== "string" ||
            !description.trim()
        ) {
            return next(new AppError(PlanMessages.DESCRIPTION_REQUIRED, 400));
        }

        if (description.trim().length > PLAN_CONSTANTS.DESCRIPTION.MAX_LENGTH) {
            return next(new AppError(PlanMessages.INVALID_DESCRIPTION, 400));
        }
        req.body.description = description.trim();

        if (type !== undefined && !PlanValidation.isValidType(type)) {
            return next(new AppError(PlanMessages.INVALID_TYPE, 400));
        }

        if (pricingModel !== undefined && !PlanValidation.isValidPricingModel(pricingModel)) {
            return next(new AppError(PlanMessages.INVALID_PRICING_MODEL, 400));
        }

        if (
            trialDays !== undefined &&
            (typeof trialDays !== "number" || trialDays < 0 || !Number.isInteger(trialDays))
        ) {
            return next(new AppError(PlanMessages.INVALID_TRIAL_DAYS, 400));
        }

        if (visibility !== undefined && !PlanValidation.isValidVisibility(visibility)) {
            return next(new AppError(PlanMessages.INVALID_VISIBILITY, 400));
        }

        if (isPopular !== undefined && typeof isPopular !== "boolean") {
            return next(new AppError(PlanMessages.INVALID_POPULAR, 400));
        }

        if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) {
            return next(new AppError(PlanMessages.INVALID_SORT_ORDER, 400));
        }

        if (isDefault !== undefined && typeof isDefault !== "boolean") {
            return next(new AppError(PlanMessages.INVALID_DEFAULT, 400));
        }

        if (isSystem !== undefined && typeof isSystem !== "boolean") {
            return next(new AppError(PlanMessages.INVALID_SYSTEM, 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(PlanMessages.INVALID_STATUS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
