import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { SystemSettingService } from "../../systemsettings/services/systemSetting.service.js";
import { SystemSettingKey } from "../../systemsettings/constants/systemSetting.enums.js";
import { AuthMessages } from "../constants/auth.messages.js";

export const resetPasswordValidation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { token, password } = req.body;

        if (token === undefined || token === null) {
            throw new AppError(
                "Password reset token is required.",
                400
            );
        }

        if (typeof token !== "string" || !token.trim()) {
            throw new AppError(
                AuthMessages.INVALID_PASSWORD_RESET_TOKEN,
                400
            );
        }

        if (password === undefined || password === null) {
            throw new AppError(
                AuthMessages.PASSWORD_REQUIRED,
                400
            );
        }

        if (typeof password !== "string" || !password) {
            throw new AppError(
                AuthMessages.INVALID_PASSWORD,
                400
            );
        }

        const systemSettingService = new SystemSettingService();

        const passwordMinLengthSetting =
            await systemSettingService.getSystemSettingByKey(
                SystemSettingKey.PASSWORD_MIN_LENGTH
            );

        const passwordMinLength = Number(
            passwordMinLengthSetting.value
        );

        if (!Number.isInteger(passwordMinLength) || passwordMinLength <= 0) {
            throw new AppError(
                "Invalid password configuration.",
                500
            );
        }

        if (password.length < passwordMinLength) {
            throw new AppError(
                `Password must contain at least ${passwordMinLength} characters.`,
                400
            );
        }

        req.body.token = token.trim();

        next();
    } catch (error) {
        next(error);
    }
};