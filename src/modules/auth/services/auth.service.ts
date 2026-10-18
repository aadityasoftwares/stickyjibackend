import bcrypt from "bcryptjs";
import { Types } from "mongoose";

import { UserRepository } from "../../user/repositories/user.repository.js";
import { UserService } from "../../user/services/user.service.js";
import { UserAuthProvider, UserStatus } from "../../user/constants/user.enums.js";
import type { IUser, IUserDocument } from "../../user/interfaces/user.interface.js";
import { UserProfileProvisioningService } from "../../userprofile/services/userProfileProvisioning.service.js";
import { UserProfileModel } from "../../userprofile/models/userProfile.model.js";

import { SessionService } from "./session.service.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuthMessages } from "../constants/auth.messages.js";
import { SessionType } from "../constants/session.constants.js";
import { AUTH_CONSTANTS } from "../constants/auth.constants.js";
import { CryptoUtil } from "../utils/crypto.util.js";
import type { IAuthUserResponse, ILoginInput, IRegisterInput } from "../interfaces/auth.interface.js";

import {
    AuditLogAction,
    AuditLogActorType,
    AuditLogSeverity,
    AuditLogStatus,
} from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { forgotPasswordEmailTemplate } from "../../../emails/templates/forgotPassword.template.js";
import { verifyEmailTemplate } from "../../../emails/templates/verifyEmail.template.js";
import { sendEmail } from "../../../emails/services/emailService.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";
import { UserSubscriptionModel } from "../../usersubscription/models/usersubscription.model.js";

import type { ISessionResponse } from "../interfaces/session.interface.js";

export interface IAuthPublicTokens {
    accessToken: string;
    accessTokenExpiresAt: Date;
}

export interface IAuthPublicResponse {
    user: IAuthUserResponse;
    sessionId: string;
    tokens: IAuthPublicTokens;
}

export interface IAuthServiceResult {
    data: IAuthPublicResponse;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
}

interface AuthSessionResult {
    userId?: string | Types.ObjectId;
    sessionId: string | Types.ObjectId;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
}

export class AuthService {
    private userRepository: UserRepository;
    private userService: UserService;
    private sessionService: SessionService;
    private auditLogService: AuditLogService;
    private userProfileProvisioningService: UserProfileProvisioningService;
    private userSubscriptionService: UserSubscriptionService;

    constructor() {
        this.userRepository = new UserRepository();
        this.userService = new UserService();
        this.sessionService = new SessionService();
        this.auditLogService = new AuditLogService();
        this.userProfileProvisioningService = new UserProfileProvisioningService();
        this.userSubscriptionService = new UserSubscriptionService();
    }

    async register(
        data: IRegisterInput,
        contextOrIp?: IAuditLogContext | string,
        userAgent?: string,
        legacyContext?: IAuditLogContext,
    ): Promise<IAuthServiceResult> {
        const context: IAuditLogContext | undefined =
            typeof contextOrIp === "object" && contextOrIp !== null ? contextOrIp : legacyContext;
        const ipAddress = typeof contextOrIp === "string" ? contextOrIp : (context?.ipAddress ?? undefined);
        const effectiveUserAgent =
            typeof contextOrIp === "string" ? userAgent : (context?.userAgent ?? userAgent);

        const normalizedEmail = data.email.trim().toLowerCase();

        const existingUser = await this.userRepository.existsByEmail(normalizedEmail);

        if (existingUser) {
            throw new AppError(AuthMessages.EMAIL_ALREADY_EXISTS, 409);
        }

        const verificationToken = CryptoUtil.generateToken();
        const emailVerificationTokenHash = CryptoUtil.hashToken(verificationToken);
        const emailVerificationExpiresAt = new Date(
            Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION.TOKEN_EXPIRES_IN_MS,
        );

        const userData: Partial<IUser> = {
            email: normalizedEmail,
            password: data.password,
            authProvider: UserAuthProvider.LOCAL,
            status: UserStatus.ACTIVE,
            isEmailVerified: false,
            emailVerificationTokenHash,
            emailVerificationExpiresAt,
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.termsAccepted && { termsAcceptedAt: new Date() }),
            ...(data.privacyPolicyAccepted && { privacyPolicyAcceptedAt: new Date() }),
        };

        let user: IUserDocument | null = null;
        let session: AuthSessionResult | null = null;

        try {
            /*
             * CRITICAL REGISTRATION PHASE
             *
             * Do not create welcome emails, audit side-effects,
             * personal workspaces, folders or starter notes yet.
             *
             * Until user + profile + session + Free subscription all succeed,
             * registration is not considered complete.
             */
            user = await this.userService.createUser(userData as IUser, context, {
                provisionDefaults: false,
                sendWelcomeEmail: false,
                writeAuditLog: false,
            });

            await this.userProfileProvisioningService.provisionRegistrationProfile(
                user._id,
                {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    countryCodeHint: data.countryCodeHint,
                    timezoneCode: data.timezoneCode,
                    locale: data.locale,
                },
                {
                    ...context,
                    actorId: user._id,
                    ipAddress: ipAddress ?? context?.ipAddress ?? null,
                    userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
                },
            );

            session = (await this.sessionService.createSession({
                userId: user._id.toString(),
                deviceId: data.deviceId,
                deviceName: data.deviceName,
                type: data.sessionType ?? SessionType.WEB,
                userAgent: effectiveUserAgent,
                ipAddress,
            })) as AuthSessionResult;

            /*
             * Provision the default Free subscription.
             * If the Free plan is missing or invalid, this fails fast with a controlled error
             * and triggers compensation rollback.
             */
            await this.userSubscriptionService.ensureFreeSubscription(user._id.toString(), context);
        } catch (error) {
            /*
             * Local MongoDB installations are commonly
             * standalone and therefore may not support
             * multi-document transactions.
             *
             * Registration uses compensation rollback:
             *
             * subscription -> session -> profile -> user
             *
             * Because default workspace seeding is delayed
             * until AFTER this phase, rollback does not leave
             * starter workspaces/folders/notes behind.
             */
            if (user) {
                await this.rollbackFailedRegistration(user._id.toString(), session?.sessionId);
            }

            throw error;
        }

        /*
         * At this point all critical records exist:
         *
         * User              ✓
         * UserProfile        ✓
         * Session           ✓
         * Free Subscription ✓
         *
         * Anything below is a post-registration side effect.
         * It must NEVER turn a successful account creation
         * into a failed API response.
         */
        await this.safeCompleteRegistration(
            user,
            data,
            verificationToken,
            ipAddress,
            effectiveUserAgent,
            context,
        );

        const profile = {
            firstName: data.firstName ?? null,
            lastName: data.lastName ?? null,
            displayName: null,
        };

        return this.toAuthServiceResult(user, session, profile);
    }

    async login(
        data: ILoginInput,
        contextOrIp?: IAuditLogContext | string,
        userAgent?: string,
        legacyContext?: IAuditLogContext,
    ): Promise<IAuthServiceResult> {
        const context: IAuditLogContext | undefined =
            typeof contextOrIp === "object" && contextOrIp !== null ? contextOrIp : legacyContext;
        const ipAddress = typeof contextOrIp === "string" ? contextOrIp : (context?.ipAddress ?? undefined);
        const effectiveUserAgent =
            typeof contextOrIp === "string" ? userAgent : (context?.userAgent ?? userAgent);

        const user = await this.userRepository.findByEmailWithPassword(data.email);

        if (!user) {
            await this.auditLogService.log({
                ...context,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                description: "Login failed because the account was not found.",
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "INVALID_CREDENTIALS",
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError(AuthMessages.INVALID_CREDENTIALS, 401);
        }

        if (user.isDeleted) {
            throw new AppError(AuthMessages.ACCOUNT_INACTIVE, 403);
        }

        if (user.status !== UserStatus.ACTIVE) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Login failed for inactive user ${user.email}.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "ACCOUNT_INACTIVE",
                    status: user.status,
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError(AuthMessages.ACCOUNT_INACTIVE, 403);
        }

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Login failed for locked user ${user.email}.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "ACCOUNT_LOCKED",
                    lockedUntil: user.lockedUntil,
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError("Account is temporarily locked. Please try again later.", 403);
        }

        if (user.authProvider !== UserAuthProvider.LOCAL) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Login failed for ${user.email} because the account uses another authentication provider.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "AUTH_PROVIDER_MISMATCH",
                    authProvider: user.authProvider,
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError("This account uses a different authentication provider.", 400);
        }

        if (!user.password) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Login failed for ${user.email} because password authentication is unavailable.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "PASSWORD_AUTH_UNAVAILABLE",
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError("Password authentication is not available for this account.", 400);
        }

        const passwordMatches = await bcrypt.compare(data.password, user.password);

        if (!passwordMatches) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.LOGIN_FAILED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Login failed for ${user.email} because of invalid credentials.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "INVALID_PASSWORD",
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
            });

            throw new AppError(AuthMessages.INVALID_CREDENTIALS, 401);
        }

        await this.userService.provisionMissingUserPreferences(user._id.toString());

        // Self-healing: ensure Free subscription exists if account has no active subscription
        try {
            await this.userSubscriptionService.ensureFreeSubscription(user._id.toString(), context);
        } catch (error) {
            console.error("Login self-healing: Free subscription ensure failed.", {
                userId: user._id.toString(),
                error,
            });
        }

        const session = (await this.sessionService.createSession({
            userId: user._id.toString(),
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            type: data.sessionType ?? SessionType.WEB,
            userAgent: effectiveUserAgent,
            ipAddress,
        })) as AuthSessionResult;

        await this.auditLogService.log({
            ...context,
            actorId: user._id,
            actorType: AuditLogActorType.USER,
            action: AuditLogAction.LOGIN,
            module: AppModule.AUTH,
            resourceType: "User",
            resourceId: user._id,
            resourceName: user.email,
            description: `User ${user.email} logged in successfully.`,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata: {
                sessionId: session.sessionId,
                sessionType: data.sessionType ?? SessionType.WEB,
                authProvider: user.authProvider,
            },
            ipAddress: ipAddress ?? context?.ipAddress ?? null,
            userAgent: effectiveUserAgent ?? context?.userAgent ?? null,
        });

        const userProfile = await UserProfileModel.findOne({ userId: user._id })
            .select("firstName lastName displayName")
            .lean()
            .exec();

        return this.toAuthServiceResult(user, session, userProfile);
    }

    async refreshToken(
        refreshToken: string,
        contextOrIp?: IAuditLogContext | string,
    ): Promise<IAuthServiceResult> {
        const context: IAuditLogContext | undefined =
            typeof contextOrIp === "object" && contextOrIp !== null ? contextOrIp : undefined;
        const ipAddress = typeof contextOrIp === "string" ? contextOrIp : (context?.ipAddress ?? undefined);

        const session = (await this.sessionService.refreshSession(
            refreshToken,
            ipAddress,
        )) as AuthSessionResult;

        if (!session.userId) {
            throw new AppError(AuthMessages.INVALID_REFRESH_TOKEN, 401);
        }

        const user = await this.userRepository.findById(session.userId.toString());

        if (!user) {
            await this.safeLogoutSession(session.sessionId);

            throw new AppError(AuthMessages.ACCOUNT_NOT_FOUND, 401);
        }

        const refreshAllowed = user.status === UserStatus.ACTIVE || user.status === UserStatus.PENDING;

        if (!refreshAllowed) {
            await this.safeLogoutSession(session.sessionId);

            throw new AppError(AuthMessages.ACCOUNT_INACTIVE, 403);
        }

        const userProfile = await UserProfileModel.findOne({ userId: user._id })
            .select("firstName lastName displayName")
            .lean()
            .exec();

        return this.toAuthServiceResult(user, session, userProfile);
    }

    async verifyEmail(token: string, context?: IAuditLogContext): Promise<void> {
        const tokenHash = CryptoUtil.hashToken(token);

        const user = await this.userRepository.findByEmailVerificationToken(tokenHash);

        if (!user) {
            await this.auditLogService.log({
                ...context,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.EMAIL_VERIFIED,
                module: AppModule.AUTH,
                resourceType: "User",
                description: "Email verification failed because the token was invalid or expired.",
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "INVALID_OR_EXPIRED_TOKEN",
                },
            });

            throw new AppError(AuthMessages.INVALID_EMAIL_VERIFICATION_TOKEN, 400);
        }

        if (user.isEmailVerified) {
            return;
        }

        user.isEmailVerified = true;
        user.emailVerifiedAt = new Date();
        user.emailVerificationTokenHash = null;
        user.emailVerificationExpiresAt = null;

        await user.save();

        await this.auditLogService.log({
            ...context,
            actorId: user._id,
            actorType: AuditLogActorType.USER,
            action: AuditLogAction.EMAIL_VERIFIED,
            module: AppModule.AUTH,
            resourceType: "User",
            resourceId: user._id,
            resourceName: user.email,
            description: `Email address for ${user.email} was verified successfully.`,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
        });
    }

    async forgotPassword(email: string, context?: IAuditLogContext): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.userRepository.findByEmail(normalizedEmail);

        if (!user || user.authProvider !== UserAuthProvider.LOCAL) {
            return;
        }

        const resetToken = CryptoUtil.generateToken();
        const resetTokenHash = CryptoUtil.hashToken(resetToken);
        const passwordResetExpiresAt = new Date(
            Date.now() + AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_IN_MS,
        );

        await this.userRepository.updateById(user._id.toString(), {
            passwordResetTokenHash: resetTokenHash,
            passwordResetExpiresAt,
        });

        try {
            await this.sendPasswordResetEmail(user.email, resetToken);

            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.PASSWORD_RESET_REQUESTED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Password reset was requested for ${user.email}.`,
                status: AuditLogStatus.SUCCESS,
                severity: AuditLogSeverity.INFO,
                metadata: {
                    expiresInMinutes: AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_IN_MINUTES,
                    delivery: "EMAIL",
                },
            });
        } catch (error) {
            await this.clearPasswordResetToken(user._id.toString());

            console.error(`Failed to send password reset email to ${user.email}.`, error);

            throw new AppError("Password reset email could not be sent. Please try again shortly.", 503);
        }
    }

    async resetPassword(token: string, password: string, context?: IAuditLogContext): Promise<void> {
        const tokenHash = CryptoUtil.hashToken(token);

        const user = await this.userRepository.findByPasswordResetToken(tokenHash);

        if (!user) {
            await this.auditLogService.log({
                ...context,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.PASSWORD_RESET,
                module: AppModule.AUTH,
                resourceType: "User",
                description: "Password reset failed because the token was invalid or expired.",
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "INVALID_OR_EXPIRED_TOKEN",
                },
            });

            throw new AppError(AuthMessages.INVALID_PASSWORD_RESET_TOKEN, 400);
        }

        if (!user.passwordResetExpiresAt) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.PASSWORD_RESET,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: "Password reset failed because the reset token expiration was missing.",
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "RESET_EXPIRATION_MISSING",
                },
            });

            throw new AppError(AuthMessages.INVALID_PASSWORD_RESET_TOKEN, 400);
        }

        const now = new Date();

        if (user.passwordResetExpiresAt.getTime() <= now.getTime()) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.PASSWORD_RESET,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Password reset failed for ${user.email} because the token expired.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "TOKEN_EXPIRED",
                },
            });

            throw new AppError(AuthMessages.INVALID_PASSWORD_RESET_TOKEN, 400);
        }

        const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.PASSWORD.SALT_ROUNDS);

        await this.userRepository.updateById(user._id.toString(), {
            password: hashedPassword,
            passwordChangedAt: now,
            passwordResetTokenHash: null,
            passwordResetExpiresAt: null,
        });

        await this.sessionService.logoutAll(user._id.toString());

        await this.auditLogService.log({
            ...context,
            actorId: user._id,
            actorType: AuditLogActorType.USER,
            action: AuditLogAction.PASSWORD_RESET,
            module: AppModule.AUTH,
            resourceType: "User",
            resourceId: user._id,
            resourceName: user.email,
            description: `Password for ${user.email} was reset successfully.`,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
        });
    }

    async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        context?: IAuditLogContext,
    ): Promise<void> {
        const user = await this.userRepository.findByIdWithPassword(userId);

        if (!user) {
            throw new AppError(AuthMessages.ACCOUNT_NOT_FOUND, 404);
        }

        if (!user.password) {
            throw new AppError("Password authentication is not available for this account.", 400);
        }

        const passwordMatches = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatches) {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.PASSWORD_CHANGED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Password change failed for ${user.email} because the current password was invalid.`,
                status: AuditLogStatus.FAILURE,
                severity: AuditLogSeverity.WARNING,
                metadata: {
                    reason: "INVALID_CURRENT_PASSWORD",
                },
            });

            throw new AppError(AuthMessages.INVALID_CURRENT_PASSWORD, 400);
        }

        const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.PASSWORD.SALT_ROUNDS);

        await this.userRepository.updateById(userId, {
            password: hashedPassword,
            passwordChangedAt: new Date(),
        });

        await this.sessionService.logoutAll(userId);

        await this.auditLogService.log({
            ...context,
            actorId: user._id,
            actorType: AuditLogActorType.USER,
            action: AuditLogAction.PASSWORD_CHANGED,
            module: AppModule.AUTH,
            resourceType: "User",
            resourceId: user._id,
            resourceName: user.email,
            description: `Password for ${user.email} was changed successfully.`,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
        });
    }

    async logout(sessionId: string, context?: IAuditLogContext): Promise<void> {
        await this.sessionService.logout(sessionId);

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.LOGOUT,
            module: AppModule.AUTH,
            resourceType: "Session",
            resourceId: sessionId,
            description: "User session was logged out successfully.",
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata: {
                sessionId,
            },
        });
    }

    async logoutAll(userId: string, context?: IAuditLogContext): Promise<void> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid user ID.", 400);
        }

        await this.sessionService.logoutAll(userId);

        const userObjectId = new Types.ObjectId(userId);

        await this.auditLogService.log({
            ...context,
            actorId: userObjectId,
            actorType: AuditLogActorType.USER,
            action: AuditLogAction.LOGOUT_ALL,
            module: AppModule.AUTH,
            resourceType: "User",
            resourceId: userObjectId,
            description: "All active user sessions were logged out successfully.",
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
        });
    }

    async getSessions(userId: string): Promise<ISessionResponse[]> {
        return this.sessionService.getUserSessions(userId);
    }

    private async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
        const resetUrl = this.buildPasswordResetUrl(resetToken);

        const html = forgotPasswordEmailTemplate({
            resetUrl,
            expiresInMinutes: AUTH_CONSTANTS.PASSWORD_RESET.TOKEN_EXPIRES_IN_MINUTES,
        });

        await sendEmail({
            to: email,
            subject: "Reset your Sticky Ji password 🔐",
            html,
        });
    }

    private buildPasswordResetUrl(resetToken: string): string {
        const frontendUrl = (process.env.FRONTEND_URL ?? "").trim().replace(/\/+$/, "");

        if (!frontendUrl) {
            throw new AppError("Password reset service is temporarily unavailable.", 503);
        }

        return `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
    }

    private async clearPasswordResetToken(userId: string): Promise<void> {
        try {
            await this.userRepository.updateById(userId, {
                passwordResetTokenHash: null,
                passwordResetExpiresAt: null,
            });
        } catch (error) {
            console.error("Failed to clear password reset token.", error);
        }
    }

    private buildEmailVerificationUrl(token: string): string {
        const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");

        return `${frontendUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;
    }

    private async sendEmailVerificationEmail(email: string, token: string): Promise<void> {
        const verificationUrl = this.buildEmailVerificationUrl(token);

        const html = verifyEmailTemplate({
            verificationUrl,
            expiresInMinutes: AUTH_CONSTANTS.EMAIL_VERIFICATION.TOKEN_EXPIRES_IN_MINUTES,
        });

        await sendEmail({
            to: email,
            subject: "Verify your Sticky Ji email address ✉️",
            html,
        });
    }

    async resendVerificationEmail(email: string, context?: IAuditLogContext): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();
        const user = await this.userRepository.findByEmail(normalizedEmail);

        if (!user || user.isDeleted || user.authProvider !== UserAuthProvider.LOCAL) {
            return;
        }

        if (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.PENDING) {
            throw new AppError(AuthMessages.ACCOUNT_INACTIVE, 403);
        }

        if (user.isEmailVerified) {
            return;
        }

        const verificationToken = CryptoUtil.generateToken();
        const emailVerificationTokenHash = CryptoUtil.hashToken(verificationToken);
        const emailVerificationExpiresAt = new Date(
            Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION.TOKEN_EXPIRES_IN_MS,
        );

        await this.userRepository.updateById(user._id.toString(), {
            emailVerificationTokenHash,
            emailVerificationExpiresAt,
        });

        try {
            await this.sendEmailVerificationEmail(user.email, verificationToken);

            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.EMAIL_VERIFIED,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `Email verification link resent to ${user.email}.`,
                status: AuditLogStatus.SUCCESS,
                severity: AuditLogSeverity.INFO,
                metadata: {
                    expiresInMinutes: AUTH_CONSTANTS.EMAIL_VERIFICATION.TOKEN_EXPIRES_IN_MINUTES,
                    delivery: "EMAIL",
                },
            });
        } catch (error) {
            console.error("Failed to resend email verification link.", {
                email: user.email,
                error,
            });
        }
    }

    private async rollbackFailedRegistration(
        userId: string,
        sessionId?: string | Types.ObjectId,
    ): Promise<void> {
        /*
         * Best-effort rollback.
         *
         * Each cleanup is isolated so one failed cleanup
         * does not prevent the remaining cleanup steps.
         */

        if (sessionId) {
            await this.safeLogoutSession(sessionId);
        }

        if (Types.ObjectId.isValid(userId)) {
            try {
                await UserSubscriptionModel.deleteMany({
                    user: new Types.ObjectId(userId),
                }).exec();
            } catch (error) {
                console.error("Failed to rollback user subscription after registration failure.", {
                    userId,
                    error,
                });
            }

            try {
                await UserProfileModel.deleteMany({
                    userId: new Types.ObjectId(userId),
                }).exec();
            } catch (error) {
                console.error("Failed to rollback user profile after registration failure.", {
                    userId,
                    error,
                });
            }
        }

        try {
            await this.userRepository.hardDeleteById(userId);
        } catch (error) {
            console.error("Failed to rollback user after registration failure.", {
                userId,
                error,
            });
        }
    }

    private async safeCompleteRegistration(
        user: IUserDocument,
        data: IRegisterInput,
        verificationToken: string,
        ipAddress?: string,
        userAgent?: string,
        context?: IAuditLogContext,
    ): Promise<void> {
        /*
         * UserService handles:
         *
         * - user-created audit log
         * - default workspace/folder/columns/starter note
         * - welcome email
         *
         * The method is intentionally non-throwing.
         */
        try {
            await this.userService.completeRegistration(user, context);
        } catch (error) {
            console.error("Registration succeeded, but post-registration user setup failed.", {
                userId: user._id.toString(),

                error,
            });
        }

        /*
         * Send verification email asynchronously.
         * Failure to deliver must never block or fail registration.
         */
        void this.sendEmailVerificationEmail(user.email, verificationToken).catch((error) => {
            console.error("Failed to send verification email during registration.", {
                email: user.email,
                error,
            });
        });

        try {
            await this.auditLogService.log({
                ...context,
                actorId: user._id,
                actorType: AuditLogActorType.USER,
                action: AuditLogAction.REGISTER,
                module: AppModule.AUTH,
                resourceType: "User",
                resourceId: user._id,
                resourceName: user.email,
                description: `User ${user.email} registered successfully.`,
                status: AuditLogStatus.SUCCESS,
                severity: AuditLogSeverity.INFO,
                metadata: {
                    authProvider: UserAuthProvider.LOCAL,
                    sessionType: data.sessionType ?? SessionType.WEB,
                },
                ipAddress: ipAddress ?? context?.ipAddress ?? null,
                userAgent: userAgent ?? context?.userAgent ?? null,
            });
        } catch (error) {
            /*
             * Audit infrastructure must not make the client
             * believe account creation failed after the
             * critical registration phase already succeeded.
             */
            console.error("Registration succeeded, but the auth audit log could not be written.", {
                userId: user._id.toString(),

                error,
            });
        }
    }

    private async safeLogoutSession(sessionId: string | Types.ObjectId): Promise<void> {
        try {
            await this.sessionService.logout(sessionId.toString());
        } catch (error) {
            console.error("Failed to revoke invalid authentication session.", {
                sessionId: sessionId.toString(),
                error,
            });
        }
    }

    private resolveId(value: unknown): string {
        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "object" && value !== null && "_id" in value) {
            return String((value as { _id?: unknown })._id ?? "");
        }

        return "";
    }

    private toAuthUserResponse(
        user: IUserDocument,
        profile?: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null,
    ): IAuthUserResponse {
        return {
            id: this.resolveId(user._id),
            email: user.email,
            globalRoleId: this.resolveId(user.globalRoleId),
            status: user.status,
            authProvider: user.authProvider,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            isMfaEnabled: user.isMfaEnabled,
            profile: profile
                ? {
                      firstName: profile.firstName ?? null,
                      lastName: profile.lastName ?? null,
                      displayName: profile.displayName ?? null,
                  }
                : null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    private toPublicAuthTokens(
        session: Pick<AuthSessionResult, "accessToken" | "accessTokenExpiresAt">,
    ): IAuthPublicTokens {
        return {
            accessToken: session.accessToken,
            accessTokenExpiresAt: session.accessTokenExpiresAt,
        };
    }

    private toAuthServiceResult(
        user: IUserDocument,
        session: AuthSessionResult,
        profile?: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null,
    ): IAuthServiceResult {
        return {
            data: {
                user: this.toAuthUserResponse(user, profile),
                sessionId: this.resolveId(session.sessionId),
                tokens: this.toPublicAuthTokens(session),
            },
            refreshToken: session.refreshToken,
            refreshTokenExpiresAt: session.refreshTokenExpiresAt,
        };
    }
}
