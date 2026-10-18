import { Types } from "mongoose";
import { UserAuthProvider } from "../../user/constants/user.enums.js";
import { AuthTokenType } from "../constants/auth.enums.js";
import { SessionType } from "../constants/session.constants.js";

export interface IRegisterInput {
    firstName: string;
    lastName: string;

    email: string;
    password: string;
    phone?: string;

    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;

    timezoneCode?: string;
    locale?: string;
    countryCodeHint?: string;

    sessionType?: SessionType;

    deviceId?: string;
    deviceName?: string;
}

export interface ILoginInput {
    email: string;
    password: string;

    deviceId?: string;
    deviceName?: string;
    sessionType?: SessionType;
}

export interface IRefreshTokenInput {
    refreshToken: string;
}

export interface ILogoutInput {
    sessionId: Types.ObjectId | string;
}

export interface IVerifyEmailInput {
    token: string;
}

export interface IResendVerificationInput {
    email: string;
}

export interface IForgotPasswordInput {
    email: string;
}

export interface IResetPasswordInput {
    token: string;
    password: string;
}

export interface IChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

export interface IAccessTokenPayload {
    sub: string;
    sessionId: string;
    tokenType: AuthTokenType.ACCESS;
    iat?: number;
    exp?: number;
}

export interface IRefreshTokenPayload {
    sub: string;
    sessionId: string;
    tokenType: AuthTokenType.REFRESH;
    version: number;
    iat?: number;
    exp?: number;
}

export interface IAuthTokens {
    accessToken: string;
    accessTokenExpiresAt: Date;
}

export interface IAuthServiceResult {
    data: IAuthResponse;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
}

export interface IAuthenticatedUser {
    userId: Types.ObjectId;
    sessionId: Types.ObjectId;
}

export interface IAuthUserResponse {
    id: Types.ObjectId;
    email: string;
    globalRoleId: Types.ObjectId;
    status: string;
    authProvider: UserAuthProvider;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    isMfaEnabled: boolean;
}

export interface IAuthResponse {
    user: IAuthUserResponse;
    sessionId: Types.ObjectId;
    tokens: IAuthTokens;
}

export interface IMfaVerifyInput {
    sessionId: Types.ObjectId | string;
    code: string;
}

export interface IAuthRequestContext {
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    deviceName?: string;
    sessionType?: SessionType;
}