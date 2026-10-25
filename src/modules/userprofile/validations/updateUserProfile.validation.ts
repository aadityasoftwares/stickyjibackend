import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { UserProfileMessages } from "../constants/userProfile.messages.js";
import { USER_PROFILE_CONSTANTS } from "../constants/userProfile.constants.js";
import { UserProfileValidation } from "./userProfile.validation.js";
import { UserProfileType } from "../constants/userProfile.enums.js";

export const updateUserProfileValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return next(new AppError(UserProfileMessages.UPDATE_REQUIRED, 400));
        }

        const {
            firstName,
            lastName,
            displayName,
            bio,
            dateOfBirth,
            profileType,
            occupation,
            education,
            interests,
            countryId,
            timezoneId,
            languageId,
            currencyId,
        } = req.body;

        if (
            firstName !== undefined &&
            (typeof firstName !== "string" ||
                firstName.trim().length < USER_PROFILE_CONSTANTS.FIRST_NAME.MIN_LENGTH ||
                firstName.trim().length > USER_PROFILE_CONSTANTS.FIRST_NAME.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_FIRST_NAME, 400));
        }

        if (
            lastName !== undefined &&
            (typeof lastName !== "string" ||
                lastName.trim().length < USER_PROFILE_CONSTANTS.LAST_NAME.MIN_LENGTH ||
                lastName.trim().length > USER_PROFILE_CONSTANTS.LAST_NAME.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_LAST_NAME, 400));
        }

        if (
            displayName !== undefined &&
            displayName !== null &&
            (typeof displayName !== "string" ||
                displayName.trim().length < USER_PROFILE_CONSTANTS.DISPLAY_NAME.MIN_LENGTH ||
                displayName.trim().length > USER_PROFILE_CONSTANTS.DISPLAY_NAME.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_DISPLAY_NAME, 400));
        }

        if (
            bio !== undefined &&
            bio !== null &&
            (typeof bio !== "string" || bio.trim().length > USER_PROFILE_CONSTANTS.BIO.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_BIO, 400));
        }

        if (
            dateOfBirth !== undefined &&
            dateOfBirth !== null &&
            (typeof dateOfBirth !== "string" ||
                Number.isNaN(Date.parse(dateOfBirth)) ||
                new Date(dateOfBirth) > new Date())
        ) {
            return next(new AppError(UserProfileMessages.INVALID_DATE_OF_BIRTH, 400));
        }

        if (
            profileType !== undefined &&
            (typeof profileType !== "string" ||
                !UserProfileValidation.profileTypes.includes(profileType as UserProfileType))
        ) {
            return next(new AppError(UserProfileMessages.INVALID_PROFILE_TYPE, 400));
        }

        if (
            occupation !== undefined &&
            occupation !== null &&
            (typeof occupation !== "string" ||
                occupation.trim().length > USER_PROFILE_CONSTANTS.OCCUPATION.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_OCCUPATION, 400));
        }

        if (
            education !== undefined &&
            education !== null &&
            (typeof education !== "string" ||
                education.trim().length > USER_PROFILE_CONSTANTS.EDUCATION.MAX_LENGTH)
        ) {
            return next(new AppError(UserProfileMessages.INVALID_EDUCATION, 400));
        }

        if (interests !== undefined) {
            if (!Array.isArray(interests) || interests.length > USER_PROFILE_CONSTANTS.INTERESTS.MAX_ITEMS) {
                return next(new AppError(UserProfileMessages.INVALID_INTERESTS, 400));
            }

            const invalidInterest = interests.some(
                (interest: unknown) =>
                    typeof interest !== "string" ||
                    interest.trim().length === 0 ||
                    interest.trim().length > USER_PROFILE_CONSTANTS.INTERESTS.MAX_ITEM_LENGTH,
            );

            if (invalidInterest) {
                return next(new AppError(UserProfileMessages.INVALID_INTERESTS, 400));
            }
        }

        const localizationIds = [
            {
                value: countryId,
                message: UserProfileMessages.INVALID_COUNTRY,
            },
            {
                value: timezoneId,
                message: UserProfileMessages.INVALID_TIMEZONE,
            },
            {
                value: languageId,
                message: UserProfileMessages.INVALID_LANGUAGE,
            },
            {
                value: currencyId,
                message: UserProfileMessages.INVALID_CURRENCY,
            },
        ];

        for (const { value, message } of localizationIds) {
            if (
                value !== undefined &&
                value !== null &&
                (typeof value !== "string" || !/^[a-fA-F0-9]{24}$/.test(value))
            ) {
                return next(new AppError(message, 400));
            }
        }

        if (req.body.profileImage !== undefined && req.body.profileImage !== null) {
            if (
                typeof req.body.profileImage !== "string" ||
                !/^[a-fA-F0-9]{24}$/.test(req.body.profileImage)
            ) {
                return next(new AppError(UserProfileMessages.INVALID_PROFILE_IMAGE, 400));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};
