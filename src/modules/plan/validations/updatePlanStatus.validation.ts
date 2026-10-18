import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { PlanMessages } from "../constants/plan.messages.js";

const ALLOWED_FIELDS = new Set(["isActive", "status", "id"]);

export const updatePlanStatusValidation = (req: Request, res: Response, next: NextFunction) => {
    if (!req.params.id && req.body?.id) {
        req.params.id = String(req.body.id);
    }

    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            const body = req.body ?? {};
            const unsupportedFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));

            if (unsupportedFields.length) {
                return next(new AppError(PlanMessages.UNSUPPORTED_FIELDS, 400));
            }

            if (typeof body.isActive !== "boolean") {
                if (body.status === "ACTIVE") {
                    body.isActive = true;
                } else if (body.status === "INACTIVE") {
                    body.isActive = false;
                } else {
                    return next(new AppError(PlanMessages.INVALID_STATUS, 400));
                }
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
