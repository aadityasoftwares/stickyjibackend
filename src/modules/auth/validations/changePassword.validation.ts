import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { SystemSettingService } from "../../systemsettings/services/systemSetting.service.js";
import { SystemSettingKey } from "../../systemsettings/constants/systemSetting.enums.js";

export const changePasswordValidation = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (currentPassword === undefined || currentPassword === null) {
            throw new AppError("Current password is required.", 400);
        }

        if (typeof currentPassword !== "string" || !currentPassword) {
            throw new AppError("Invalid current password.", 400);
        }

        if (newPassword === undefined || newPassword === null) {
            throw new AppError("New password is required.", 400);
        }

        if (typeof newPassword !== "string" || !newPassword) {
            throw new AppError("Invalid new password.", 400);
        }

        const systemSettingService = new SystemSettingService();

        const passwordMinLengthSetting = await systemSettingService.getSystemSettingByKey(
            SystemSettingKey.PASSWORD_MIN_LENGTH,
        );

        const passwordMinLength = Number(passwordMinLengthSetting.value);

        if (!Number.isInteger(passwordMinLength) || passwordMinLength <= 0) {
            throw new AppError("Invalid password configuration.", 500);
        }

        if (newPassword.length < passwordMinLength) {
            throw new AppError(`Password must contain at least ${passwordMinLength} characters.`, 400);
        }

        if (currentPassword === newPassword) {
            throw new AppError("New password must be different from the current password.", 400);
        }

        next();
    } catch (error) {
        next(error);
    }
};
