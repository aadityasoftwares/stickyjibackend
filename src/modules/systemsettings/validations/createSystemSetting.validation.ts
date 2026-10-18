import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { SystemSettingMessages } from "../constants/systemSetting.messages.js";
import { SystemSettingValidation } from "./systemSetting.validation.js";

export const createSystemSettingValidation = (req: Request, res: Response, next: NextFunction) => {
    const { key, value, valueType, category, description, defaultValue, isEditable, isPublic } = req.body;

    if (!key) {
        return next(new AppError(SystemSettingMessages.KEY_REQUIRED, 400));
    }

    const normalizedKey = key.toUpperCase().trim();

    if (!SystemSettingValidation.keys.includes(normalizedKey as any)) {
        return next(new AppError(SystemSettingMessages.INVALID_KEY, 400));
    }

    if (value === undefined) {
        return next(new AppError(SystemSettingMessages.VALUE_REQUIRED, 400));
    }

    if (!valueType) {
        return next(new AppError(SystemSettingMessages.VALUE_TYPE_REQUIRED, 400));
    }

    if (!SystemSettingValidation.valueTypes.includes(valueType)) {
        return next(new AppError(SystemSettingMessages.INVALID_VALUE_TYPE, 400));
    }

    if (!category) {
        return next(new AppError(SystemSettingMessages.CATEGORY_REQUIRED, 400));
    }

    if (!SystemSettingValidation.categories.includes(category)) {
        return next(new AppError(SystemSettingMessages.INVALID_CATEGORY, 400));
    }

    if (!description) {
        return next(new AppError(SystemSettingMessages.DESCRIPTION_REQUIRED, 400));
    }

    if (isEditable !== undefined && typeof isEditable !== "boolean") {
        return next(new AppError(SystemSettingMessages.INVALID_BOOLEAN_VALUE, 400));
    }

    if (isPublic !== undefined && typeof isPublic !== "boolean") {
        return next(new AppError(SystemSettingMessages.INVALID_BOOLEAN_VALUE, 400));
    }

    if (defaultValue !== undefined && defaultValue !== null) {
        switch (valueType) {
            case "STRING":
                if (typeof defaultValue !== "string") {
                    return next(new AppError(SystemSettingMessages.INVALID_STRING_VALUE, 400));
                }
                break;

            case "NUMBER":
                if (typeof defaultValue !== "number" || Number.isNaN(defaultValue)) {
                    return next(new AppError(SystemSettingMessages.INVALID_NUMBER_VALUE, 400));
                }
                break;

            case "BOOLEAN":
                if (typeof defaultValue !== "boolean") {
                    return next(new AppError(SystemSettingMessages.INVALID_BOOLEAN_VALUE, 400));
                }
                break;

            case "JSON":
                if (typeof defaultValue !== "object" || Array.isArray(defaultValue)) {
                    return next(new AppError(SystemSettingMessages.INVALID_JSON_VALUE, 400));
                }
                break;
        }
    }

    next();
};
