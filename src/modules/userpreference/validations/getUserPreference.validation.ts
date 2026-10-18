import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import {
    UserPreferenceCategory,
    UserPreferenceValueType,
} from "../constants/userPreference.enums.js";
import { UserPreferenceValidation } from "./userPreference.validation.js";

export const getUserPreferencesValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const paramKey = req.params.key;
        const { key, category, valueType } = req.query;

        if (paramKey !== undefined) {
            if (typeof paramKey !== "string" || !UserPreferenceValidation.isValidKey(paramKey)) {
                return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
            }
        }

        if (key !== undefined) {
            if (typeof key !== "string" || !UserPreferenceValidation.isValidKey(key)) {
                return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
            }
        }

        if (category !== undefined) {
            if (
                typeof category !== "string" ||
                !Object.values(UserPreferenceCategory).includes(category as UserPreferenceCategory)
            ) {
                return next(new AppError(UserPreferenceMessages.INVALID_CATEGORY, 400));
            }
        }

        if (valueType !== undefined) {
            if (
                typeof valueType !== "string" ||
                !Object.values(UserPreferenceValueType).includes(valueType as UserPreferenceValueType)
            ) {
                return next(new AppError(UserPreferenceMessages.INVALID_VALUE_TYPE, 400));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};