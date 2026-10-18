import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import { UserPreferenceValidation } from "./userPreference.validation.js";

export const resetUserPreferenceValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { key } = req.body ?? {};

        if (typeof key !== "string" || !key.trim()) {
            return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
        }

        if (!UserPreferenceValidation.getCanonicalKey(key)) {
            return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
