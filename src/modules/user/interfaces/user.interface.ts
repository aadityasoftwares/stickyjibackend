import { Document, Types } from "mongoose";
import { UserStatus, UserAuthProvider } from "../constants/user.enums.js";

export interface IUser {
    email: string;
    password?: string;
    globalRoleId: Types.ObjectId;
    status: UserStatus;
    authProvider: UserAuthProvider;
    providerId?: string | null;
    isEmailVerified: boolean;
    emailVerifiedAt?: Date | null;
    phone?: string | null;
    isPhoneVerified: boolean;
    phoneVerifiedAt?: Date | null;
    isMfaEnabled: boolean;
    mfaSecret?: string | null;
    mfaEnabledAt?: Date | null;
    lastLoginAt?: Date | null;
    lastLogoutAt?: Date | null;
    lastLoginIp?: string | null;
    loginAttempts: number;
    lockedUntil?: Date | null;
    passwordChangedAt?: Date | null;
    passwordResetTokenHash?: string | null;
    passwordResetExpiresAt?: Date | null;
    emailVerificationTokenHash?: string | null;
    emailVerificationExpiresAt?: Date | null;
    termsAcceptedAt?: Date | null;
    privacyPolicyAcceptedAt?: Date | null;
    isDeleted: boolean;
    deletedAt?: Date | null;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUserFilter {
    page?: number;
    limit?: number;
    search?: string;
    email?: string;
    globalRoleId?: Types.ObjectId | string;
    status?: UserStatus;
    authProvider?: UserAuthProvider;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    isMfaEnabled?: boolean;
    isDeleted?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IUserDocument extends IUser, Document {}
export interface IUserDocument extends IUser, Document {}

export interface IUserPaginatedResult {
    data: IUserDocument[];
    total: number;
}
