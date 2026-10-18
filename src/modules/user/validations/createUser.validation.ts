import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserMessages } from "../constants/user.messages.js";
import { UserValidation } from "./user.validation.js";
import { UserAuthProvider } from "../constants/user.enums.js";
import { SystemSettingService } from "../../systemsettings/services/systemSetting.service.js";
import { SystemSettingKey } from "../../systemsettings/constants/systemSetting.enums.js";

export const createUserValidation = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            email,
            password,
            globalRoleId,
            status,
            authProvider,
            providerId,
            phone,
            isEmailVerified,
            isPhoneVerified,
            isMfaEnabled,
            mfaSecret,
            mfaEnabledAt,
            termsAcceptedAt,
            privacyPolicyAcceptedAt,
        } = req.body;

        if (!email) {
            return next(new AppError(UserMessages.EMAIL_REQUIRED, 400));
        }

        if (typeof email !== "string") {
            return next(new AppError(UserMessages.INVALID_EMAIL, 400));
        }

        if (!globalRoleId) {
            return next(new AppError(UserMessages.ROLE_REQUIRED, 400));
        }

        if (typeof globalRoleId !== "string") {
            return next(new AppError(UserMessages.INVALID_ROLE, 400));
        }

        if (!authProvider) {
            return next(new AppError(UserMessages.AUTH_PROVIDER_REQUIRED, 400));
        }

        if (!UserValidation.authProviders.includes(authProvider)) {
            return next(new AppError(UserMessages.INVALID_AUTH_PROVIDER, 400));
        }

        if (authProvider === UserAuthProvider.LOCAL && !password) {
            return next(new AppError(UserMessages.PASSWORD_REQUIRED, 400));
        }

        if (password !== undefined) {
            if (typeof password !== "string") {
                return next(new AppError(UserMessages.INVALID_PASSWORD, 400));
            }

            const systemSettingService = new SystemSettingService();

            const passwordMinLengthSetting = await systemSettingService.getSystemSettingByKey(
                SystemSettingKey.PASSWORD_MIN_LENGTH,
            );

            const passwordMinLength = Number(passwordMinLengthSetting.value);

            if (!Number.isInteger(passwordMinLength) || passwordMinLength <= 0) {
                return next(new AppError(UserMessages.INVALID_PASSWORD, 400));
            }

            if (password.length < passwordMinLength) {
                return next(
                    new AppError(`Password must contain at least ${passwordMinLength} characters.`, 400),
                );
            }
        }

        if (providerId !== undefined && providerId !== null) {
            if (typeof providerId !== "string" || !providerId.trim()) {
                return next(new AppError(UserMessages.INVALID_PROVIDER_ID, 400));
            }
        }

        if (phone !== undefined && phone !== null) {
            if (typeof phone !== "string") {
                return next(new AppError(UserMessages.INVALID_PHONE, 400));
            }
        }

        if (status !== undefined) {
            if (!UserValidation.statuses.includes(status)) {
                return next(new AppError(UserMessages.INVALID_STATUS, 400));
            }
        }

        if (isEmailVerified !== undefined && typeof isEmailVerified !== "boolean") {
            return next(new AppError(UserMessages.INVALID_BOOLEAN_VALUE, 400));
        }

        if (isPhoneVerified !== undefined && typeof isPhoneVerified !== "boolean") {
            return next(new AppError(UserMessages.INVALID_BOOLEAN_VALUE, 400));
        }

        if (isMfaEnabled !== undefined && typeof isMfaEnabled !== "boolean") {
            return next(new AppError(UserMessages.INVALID_BOOLEAN_VALUE, 400));
        }

        if (mfaSecret !== undefined && mfaSecret !== null) {
            if (typeof mfaSecret !== "string") {
                return next(new AppError(UserMessages.INVALID_MFA_SECRET, 400));
            }
        }

        if (mfaEnabledAt !== undefined && mfaEnabledAt !== null) {
            if (typeof mfaEnabledAt !== "string" || Number.isNaN(Date.parse(mfaEnabledAt))) {
                return next(new AppError(UserMessages.INVALID_MFA_ENABLED_AT, 400));
            }
        }

        if (termsAcceptedAt !== undefined && termsAcceptedAt !== null) {
            if (typeof termsAcceptedAt !== "string" || Number.isNaN(Date.parse(termsAcceptedAt))) {
                return next(new AppError(UserMessages.INVALID_TERMS_ACCEPTED_AT, 400));
            }
        }

        if (privacyPolicyAcceptedAt !== undefined && privacyPolicyAcceptedAt !== null) {
            if (
                typeof privacyPolicyAcceptedAt !== "string" ||
                Number.isNaN(Date.parse(privacyPolicyAcceptedAt))
            ) {
                return next(new AppError(UserMessages.INVALID_PRIVACY_POLICY_ACCEPTED_AT, 400));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};
