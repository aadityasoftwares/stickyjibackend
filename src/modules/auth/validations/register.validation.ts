import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { validateEmailValue } from "../../../utils/validations/validateEmail.js";
import { validatePhoneValue } from "../../../utils/validations/validatePhone.js";
import { SystemSettingService } from "../../systemsettings/services/systemSetting.service.js";
import { SystemSettingKey } from "../../systemsettings/constants/systemSetting.enums.js";
import { SessionType } from "../constants/session.constants.js";
import { AuthMessages } from "../constants/auth.messages.js";

export const registerValidation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            email,
            password,
            phone,
            termsAccepted,
            privacyPolicyAccepted,
            deviceId,
            deviceName,
            sessionType,
        } = req.body;

        req.body.email = validateEmailValue(email, "email");

        if (password === undefined || password === null) {
            throw new AppError(AuthMessages.PASSWORD_REQUIRED, 400);
        }

        if (typeof password !== "string" || !password) {
            throw new AppError(AuthMessages.INVALID_PASSWORD, 400);
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

        const normalizedPhone = validatePhoneValue(
            phone,
            "phone",
            false
        );

        if (normalizedPhone !== undefined) {
            req.body.phone = normalizedPhone;
        } else {
            delete req.body.phone;
        }

        if (termsAccepted !== true) {
            throw new AppError(
                AuthMessages.TERMS_REQUIRED,
                400
            );
        }

        if (privacyPolicyAccepted !== true) {
            throw new AppError(
                AuthMessages.PRIVACY_POLICY_REQUIRED,
                400
            );
        }

        if (deviceId !== undefined && deviceId !== null) {
            if (typeof deviceId !== "string" || !deviceId.trim()) {
                throw new AppError(
                    AuthMessages.DEVICE_ID_INVALID,
                    400
                );
            }

            req.body.deviceId = deviceId.trim();
        }

        if (deviceName !== undefined && deviceName !== null) {
            if (typeof deviceName !== "string" || !deviceName.trim()) {
                throw new AppError(
                    AuthMessages.DEVICE_NAME_INVALID,
                    400
                );
            }

            const normalizedDeviceName = deviceName.trim();

            if (normalizedDeviceName.length > 200) {
                throw new AppError(
                    "Device name cannot exceed 200 characters.",
                    400
                );
            }

            req.body.deviceName = normalizedDeviceName;
        }

        if (sessionType !== undefined && sessionType !== null) {
            if (
                typeof sessionType !== "string" ||
                !Object.values(SessionType).includes(
                    sessionType as SessionType
                )
            ) {
                throw new AppError(
                    AuthMessages.SESSION_TYPE_INVALID,
                    400
                );
            }

            req.body.sessionType = sessionType;
        }

        req.body.termsAccepted = true;
        req.body.privacyPolicyAccepted = true;

        next();
    } catch (error) {
        next(error);
    }
};