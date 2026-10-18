import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import { UserPreferenceValidation } from "./userPreference.validation.js";
import type { UserPreferenceValue } from "../interfaces/userPreference.interface.js";

export const updateUserPreferenceValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return next(new AppError(UserPreferenceMessages.UPDATE_REQUIRED, 400));
        }

        const { key, value } = req.body;

        if (typeof key !== "string" || !key.trim()) {
            return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
        }

        const canonicalKey = UserPreferenceValidation.getCanonicalKey(key);

        if (!canonicalKey) {
            return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
        }

        if (value === undefined) {
            return next(new AppError(UserPreferenceMessages.VALUE_REQUIRED, 400));
        }

        const definition = UserPreferenceValidation.getDefinition(canonicalKey);

        if (!definition) {
            return next(new AppError(UserPreferenceMessages.INVALID_KEY, 400));
        }

        if (!UserPreferenceValidation.isValidValue(value, definition.type)) {
            return next(new AppError(UserPreferenceMessages.INVALID_VALUE, 400));
        }

        // Normalize and domain-validate; write normalized value back to req.body
        const normalizedValue = UserPreferenceValidation.normalizeValue(
            canonicalKey,
            value as UserPreferenceValue,
        );
        const domainError = UserPreferenceValidation.validateDomainValue(canonicalKey, normalizedValue);

        if (domainError) {
            return next(new AppError(domainError, 400));
        }

        req.body.value = normalizedValue;

        next();
    } catch (error) {
        next(error);
    }
};
