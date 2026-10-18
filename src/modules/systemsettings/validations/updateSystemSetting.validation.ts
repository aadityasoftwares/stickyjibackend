import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { SystemSettingMessages } from "../constants/systemSetting.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateSystemSettingValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const { key, valueType, category, value, description, defaultValue, isEditable, isPublic } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(SystemSettingMessages.UPDATE_REQUIRED, 400));
        }

        if (key !== undefined) {
            return next(new AppError(SystemSettingMessages.KEY_NOT_EDITABLE, 400));
        }

        if (valueType !== undefined) {
            return next(new AppError(SystemSettingMessages.VALUE_TYPE_NOT_EDITABLE, 400));
        }

        if (category !== undefined) {
            return next(new AppError(SystemSettingMessages.CATEGORY_NOT_EDITABLE, 400));
        }

        if (value === undefined && defaultValue !== undefined) {
            return next(new AppError(SystemSettingMessages.VALUE_REQUIRED, 400));
        }

        if (description !== undefined && typeof description !== "string") {
            return next(new AppError(SystemSettingMessages.DESCRIPTION_REQUIRED, 400));
        }

        if (isEditable !== undefined && typeof isEditable !== "boolean") {
            return next(new AppError(SystemSettingMessages.INVALID_BOOLEAN_VALUE, 400));
        }

        if (isPublic !== undefined && typeof isPublic !== "boolean") {
            return next(new AppError(SystemSettingMessages.INVALID_BOOLEAN_VALUE, 400));
        }

        next();
    });
};
