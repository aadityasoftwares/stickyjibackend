import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserMessages } from "../constants/user.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateUserValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const {
            email,
            password,
            globalRoleId,
            phone,
            isEmailVerified,
            emailVerifiedAt,
            isPhoneVerified,
            phoneVerifiedAt,
            isMfaEnabled,
            mfaSecret,
            mfaEnabledAt,
            termsAcceptedAt,
            privacyPolicyAcceptedAt,
        } = req.body;

        if (Object.keys(req.body).length === 0) {
            return next(new AppError(UserMessages.UPDATE_REQUIRED, 400));
        }

        if (email !== undefined) {
            return next(new AppError(UserMessages.EMAIL_CANNOT_BE_UPDATED, 400));
        }

        if (password !== undefined) {
            return next(new AppError(UserMessages.PASSWORD_CANNOT_BE_UPDATED, 400));
        }

        if (globalRoleId !== undefined) {
            return next(new AppError(UserMessages.ROLE_CANNOT_BE_UPDATED, 400));
        }

        if (phone !== undefined && phone !== null) {
            if (typeof phone !== "string") {
                return next(new AppError(UserMessages.INVALID_PHONE, 400));
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

        if (emailVerifiedAt !== undefined && emailVerifiedAt !== null) {
            if (Number.isNaN(Date.parse(emailVerifiedAt))) {
                return next(new AppError(UserMessages.INVALID_EMAIL_VERIFIED_AT, 400));
            }
        }

        if (phoneVerifiedAt !== undefined && phoneVerifiedAt !== null) {
            if (Number.isNaN(Date.parse(phoneVerifiedAt))) {
                return next(new AppError(UserMessages.INVALID_PHONE_VERIFIED_AT, 400));
            }
        }

        if (mfaSecret !== undefined && mfaSecret !== null) {
            if (typeof mfaSecret !== "string") {
                return next(new AppError(UserMessages.INVALID_MFA_SECRET, 400));
            }
        }

        if (mfaEnabledAt !== undefined && mfaEnabledAt !== null) {
            if (Number.isNaN(Date.parse(mfaEnabledAt))) {
                return next(new AppError(UserMessages.INVALID_MFA_ENABLED_AT, 400));
            }
        }

        if (termsAcceptedAt !== undefined && termsAcceptedAt !== null) {
            if (Number.isNaN(Date.parse(termsAcceptedAt))) {
                return next(new AppError(UserMessages.INVALID_TERMS_ACCEPTED_AT, 400));
            }
        }

        if (privacyPolicyAcceptedAt !== undefined && privacyPolicyAcceptedAt !== null) {
            if (Number.isNaN(Date.parse(privacyPolicyAcceptedAt))) {
                return next(new AppError(UserMessages.INVALID_PRIVACY_POLICY_ACCEPTED_AT, 400));
            }
        }

        next();
    });
};
