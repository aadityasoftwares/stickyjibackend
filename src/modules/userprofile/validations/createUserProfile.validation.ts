import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserProfileMessages } from "../constants/userProfile.messages.js";
import { USER_PROFILE_CONSTANTS } from "../constants/userProfile.constants.js";
import { UserProfileValidation } from "./userProfile.validation.js";

export const createUserProfileValidation = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
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

        if (!firstName) {
            return next(
                new AppError(
                    UserProfileMessages.FIRST_NAME_REQUIRED,
                    400
                )
            );
        }

        if (
            typeof firstName !== "string" ||
            firstName.trim().length <
            USER_PROFILE_CONSTANTS.FIRST_NAME.MIN_LENGTH ||
            firstName.trim().length >
            USER_PROFILE_CONSTANTS.FIRST_NAME.MAX_LENGTH
        ) {
            return next(
                new AppError(
                    UserProfileMessages.INVALID_FIRST_NAME,
                    400
                )
            );
        }

        if (!lastName) {
            return next(
                new AppError(
                    UserProfileMessages.LAST_NAME_REQUIRED,
                    400
                )
            );
        }

        if (
            typeof lastName !== "string" ||
            lastName.trim().length <
            USER_PROFILE_CONSTANTS.LAST_NAME.MIN_LENGTH ||
            lastName.trim().length >
            USER_PROFILE_CONSTANTS.LAST_NAME.MAX_LENGTH
        ) {
            return next(
                new AppError(
                    UserProfileMessages.INVALID_LAST_NAME,
                    400
                )
            );
        }

        if (displayName !== undefined && displayName !== null) {
            if (
                typeof displayName !== "string" ||
                displayName.trim().length <
                USER_PROFILE_CONSTANTS.DISPLAY_NAME.MIN_LENGTH ||
                displayName.trim().length >
                USER_PROFILE_CONSTANTS.DISPLAY_NAME.MAX_LENGTH
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_DISPLAY_NAME,
                        400
                    )
                );
            }
        }

        if (bio !== undefined && bio !== null) {
            if (
                typeof bio !== "string" ||
                bio.trim().length >
                USER_PROFILE_CONSTANTS.BIO.MAX_LENGTH
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_BIO,
                        400
                    )
                );
            }
        }

        if (dateOfBirth !== undefined && dateOfBirth !== null) {
            if (
                typeof dateOfBirth !== "string" ||
                Number.isNaN(Date.parse(dateOfBirth))
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_DATE_OF_BIRTH,
                        400
                    )
                );
            }

            if (new Date(dateOfBirth) > new Date()) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_DATE_OF_BIRTH,
                        400
                    )
                );
            }
        }

        if (profileType !== undefined) {
            if (
                !UserProfileValidation.profileTypes.includes(
                    profileType
                )
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_PROFILE_TYPE,
                        400
                    )
                );
            }
        }

        if (occupation !== undefined && occupation !== null) {
            if (
                typeof occupation !== "string" ||
                occupation.trim().length >
                USER_PROFILE_CONSTANTS.OCCUPATION.MAX_LENGTH
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_OCCUPATION,
                        400
                    )
                );
            }
        }

        if (education !== undefined && education !== null) {
            if (
                typeof education !== "string" ||
                education.trim().length >
                USER_PROFILE_CONSTANTS.EDUCATION.MAX_LENGTH
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_EDUCATION,
                        400
                    )
                );
            }
        }

        if (interests !== undefined) {
            if (!Array.isArray(interests)) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_INTERESTS,
                        400
                    )
                );
            }

            if (
                interests.length >
                USER_PROFILE_CONSTANTS.INTERESTS.MAX_ITEMS
            ) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_INTERESTS,
                        400
                    )
                );
            }

            const invalidInterest = interests.some(
                (interest: unknown) =>
                    typeof interest !== "string" ||
                    interest.trim().length === 0 ||
                    interest.trim().length >
                    USER_PROFILE_CONSTANTS.INTERESTS
                        .MAX_ITEM_LENGTH
            );

            if (invalidInterest) {
                return next(
                    new AppError(
                        UserProfileMessages.INVALID_INTERESTS,
                        400
                    )
                );
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

        for (const item of localizationIds) {
            if (item.value !== undefined && item.value !== null) {
                if (
                    typeof item.value !== "string" ||
                    !/^[a-fA-F0-9]{24}$/.test(item.value)
                ) {
                    return next(
                        new AppError(item.message, 400)
                    );
                }
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};