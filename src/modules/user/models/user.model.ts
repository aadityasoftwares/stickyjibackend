import mongoose, { Model, Schema } from "mongoose";

import type { IUserDocument } from "../interfaces/user.interface.js";

import { UserAuthProvider, UserStatus } from "../constants/user.enums.js";

import {
    DEFAULT_USER_STATUS,
    DEFAULT_USER_AUTH_PROVIDER,
    DEFAULT_USER_EMAIL_VERIFIED,
    DEFAULT_USER_PHONE_VERIFIED,
    DEFAULT_USER_MFA_ENABLED,
    DEFAULT_USER_LOGIN_ATTEMPTS,
    DEFAULT_USER_DELETED,
} from "../constants/user.constants.js";

const UserSchema = new Schema<IUserDocument>(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        password: {
            type: String,
            select: false,
            minlength: 8,
        },

        globalRoleId: {
            type: Schema.Types.ObjectId,
            ref: "Role",
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(UserStatus),
            required: true,
            default: DEFAULT_USER_STATUS,
        },

        authProvider: {
            type: String,
            enum: Object.values(UserAuthProvider),
            required: true,
            default: DEFAULT_USER_AUTH_PROVIDER,
        },

        providerId: {
            type: String,
            trim: true,
            default: null,
        },

        isEmailVerified: {
            type: Boolean,
            default: DEFAULT_USER_EMAIL_VERIFIED,
        },

        emailVerifiedAt: {
            type: Date,
            default: null,
        },

        phone: {
            type: String,
            trim: true,
            default: null,
        },

        isPhoneVerified: {
            type: Boolean,
            default: DEFAULT_USER_PHONE_VERIFIED,
        },

        phoneVerifiedAt: {
            type: Date,
            default: null,
        },

        isMfaEnabled: {
            type: Boolean,
            default: DEFAULT_USER_MFA_ENABLED,
        },

        mfaSecret: {
            type: String,
            select: false,
            default: null,
        },

        mfaEnabledAt: {
            type: Date,
            default: null,
        },

        lastLoginAt: {
            type: Date,
            default: null,
        },

        lastLogoutAt: {
            type: Date,
            default: null,
        },

        lastLoginIp: {
            type: String,
            default: null,
            trim: true,
        },

        loginAttempts: {
            type: Number,
            default: DEFAULT_USER_LOGIN_ATTEMPTS,
            min: 0,
        },

        lockedUntil: {
            type: Date,
            default: null,
        },

        passwordChangedAt: {
            type: Date,
            default: null,
        },

        passwordResetTokenHash: {
            type: String,
            select: false,
            default: null,
        },

        passwordResetExpiresAt: {
            type: Date,
            select: false,
            default: null,
        },

        emailVerificationTokenHash: {
            type: String,
            select: false,
            default: null,
        },

        emailVerificationExpiresAt: {
            type: Date,
            select: false,
            default: null,
        },

        termsAcceptedAt: {
            type: Date,
            default: null,
        },

        privacyPolicyAcceptedAt: {
            type: Date,
            default: null,
        },

        isDeleted: {
            type: Boolean,
            default: DEFAULT_USER_DELETED,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

/*
 * Define each index exactly once.
 */
UserSchema.index(
    {
        email: 1,
    },
    {
        unique: true,
        name: "email_1",
    },
);

UserSchema.index({
    globalRoleId: 1,
});

UserSchema.index({
    status: 1,
});

UserSchema.index({
    authProvider: 1,
});

UserSchema.index({
    isEmailVerified: 1,
});

UserSchema.index({
    isPhoneVerified: 1,
});

UserSchema.index({
    isMfaEnabled: 1,
});

UserSchema.index({
    isDeleted: 1,
});

UserSchema.index({
    lockedUntil: 1,
});

UserSchema.index({
    status: 1,
    isDeleted: 1,
});

UserSchema.index({
    globalRoleId: 1,
    status: 1,
});

/*
 * Multiple LOCAL users usually have providerId = null,
 * therefore the unique provider index is partial.
 */
UserSchema.index(
    {
        authProvider: 1,
        providerId: 1,
    },
    {
        unique: true,
        name: "authProvider_1_providerId_1",

        partialFilterExpression: {
            providerId: {
                $type: "string",
            },
        },
    },
);

export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>("User", UserSchema);
