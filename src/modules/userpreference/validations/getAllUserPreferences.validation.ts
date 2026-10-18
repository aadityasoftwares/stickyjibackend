import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import { UserPreferenceCategory } from "../constants/userPreference.enums.js";

export const getAllUserPreferencesValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const { category } = req.query;

        if (
            category !== undefined &&
            (
                typeof category !== "string" ||
                !Object.values(UserPreferenceCategory).includes(category as UserPreferenceCategory)
            )
        ) {
            return next(new AppError(UserPreferenceMessages.INVALID_CATEGORY, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};