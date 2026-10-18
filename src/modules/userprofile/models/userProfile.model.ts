import mongoose, {
    Model,
    Schema,
} from "mongoose";

import { UserProfileType } from "../constants/userProfile.enums.js";
import { USER_PROFILE_CONSTANTS } from "../constants/userProfile.constants.js";
import type { IUserProfileDocument } from "../interfaces/userProfile.interface.js";

const UserProfileSchema =
    new Schema<IUserProfileDocument>(
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            firstName: {
                type: String,
                required: true,
                trim: true,
                minlength:
                    USER_PROFILE_CONSTANTS
                        .FIRST_NAME
                        .MIN_LENGTH,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .FIRST_NAME
                        .MAX_LENGTH,
            },

            lastName: {
                type: String,
                required: true,
                trim: true,
                minlength:
                    USER_PROFILE_CONSTANTS
                        .LAST_NAME
                        .MIN_LENGTH,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .LAST_NAME
                        .MAX_LENGTH,
            },

            displayName: {
                type: String,
                trim: true,
                minlength:
                    USER_PROFILE_CONSTANTS
                        .DISPLAY_NAME
                        .MIN_LENGTH,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .DISPLAY_NAME
                        .MAX_LENGTH,
                default: null,
            },

            bio: {
                type: String,
                trim: true,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .BIO
                        .MAX_LENGTH,
                default: null,
            },

            dateOfBirth: {
                type: Date,
                default: null,
            },

            profileType: {
                type: String,
                enum:
                    Object.values(
                        UserProfileType,
                    ),
                required: true,
                default:
                    UserProfileType.PERSONAL,
            },

            occupation: {
                type: String,
                trim: true,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .OCCUPATION
                        .MAX_LENGTH,
                default: null,
            },

            education: {
                type: String,
                trim: true,
                maxlength:
                    USER_PROFILE_CONSTANTS
                        .EDUCATION
                        .MAX_LENGTH,
                default: null,
            },

            interests: {
                type: [String],
                default: [],
                validate: {
                    validator:
                        (
                            value:
                                string[],
                        ) =>
                            value.length <=
                            USER_PROFILE_CONSTANTS
                                .INTERESTS
                                .MAX_ITEMS &&
                            value.every(
                                item =>
                                    item.length <=
                                    USER_PROFILE_CONSTANTS
                                        .INTERESTS
                                        .MAX_ITEM_LENGTH,
                            ),

                    message:
                        "Invalid interests.",
                },
            },

            countryId: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "Country",
                default: null,
            },

            timezoneId: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "Timezone",
                default: null,
            },

            languageId: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "Language",
                default: null,
            },

            currencyId: {
                type:
                    Schema.Types
                        .ObjectId,
                ref: "Currency",
                default: null,
            },
        },
        {
            timestamps: true,
        },
    );

/*
 * Keep indexes in ONE place.
 *
 * Do not use both `index: true` / `unique: true`
 * on the field and Schema.index() for the same key.
 */
UserProfileSchema.index(
    {
        userId: 1,
    },
    {
        unique: true,
        name: "userId_1",
    },
);

UserProfileSchema.index({
    profileType: 1,
});

UserProfileSchema.index({
    countryId: 1,
});

UserProfileSchema.index({
    timezoneId: 1,
});

UserProfileSchema.index({
    languageId: 1,
});

UserProfileSchema.index({
    currencyId: 1,
});

UserProfileSchema.index({
    firstName: 1,
    lastName: 1,
});

export const UserProfileModel:
    Model<IUserProfileDocument> =
    mongoose.model<IUserProfileDocument>(
        "UserProfile",
        UserProfileSchema,
    );
