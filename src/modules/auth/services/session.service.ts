import { Types } from "mongoose";

import { SessionRepository } from "../repositories/session.repository.js";
import { JwtUtil } from "../utils/jwt.util.js";
import { CryptoUtil } from "../utils/crypto.util.js";
import {
    SessionStatus,
    SessionType,
} from "../constants/session.constants.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AUTH_CONSTANTS } from "../constants/auth.constants.js";

export interface CreateSessionOptions {
    userId: string;
    type?: SessionType;
    deviceId?: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
}

export interface SessionTokens {
    userId: string;
    sessionId: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
}

export class SessionService {
    private readonly sessionRepository: SessionRepository;

    constructor() {
        this.sessionRepository = new SessionRepository();
    }

    async createSession(
        options: CreateSessionOptions,
    ): Promise<SessionTokens> {
        const {
            userId,
            type = SessionType.WEB,
            deviceId,
            deviceName,
            userAgent,
            ipAddress,
        } = options;

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid user ID.", 400);
        }

        const sessionId = new Types.ObjectId();
        const refreshTokenVersion = 1;

        const refreshToken = JwtUtil.generateRefreshToken(
            userId,
            sessionId.toString(),
            refreshTokenVersion,
        );

        const refreshTokenHash = CryptoUtil.hashToken(refreshToken);
        const refreshTokenExpiresAt = this.getRefreshTokenExpiry();

        const session = await this.sessionRepository.create({
            _id: sessionId,
            userId: new Types.ObjectId(userId),
            type,
            refreshTokenHash,
            refreshTokenVersion,
            status: SessionStatus.ACTIVE,
            deviceId: deviceId ?? null,
            deviceName: deviceName ?? null,
            userAgent: userAgent ?? null,
            createdIpAddress: ipAddress ?? null,
            lastIpAddress: ipAddress ?? null,
            lastUsedAt: new Date(),
            lastRefreshAt: null,
            expiresAt: refreshTokenExpiresAt,
        });

        const accessToken = JwtUtil.generateAccessToken(
            userId,
            sessionId.toString(),
        );

        return {
            userId,
            sessionId: session._id.toString(),
            accessToken,
            refreshToken,
            accessTokenExpiresAt: this.getJwtExpiry(accessToken),
            refreshTokenExpiresAt,
        };
    }

    async refreshSession(
        refreshToken: string,
        ipAddress?: string,
    ): Promise<SessionTokens> {
        if (!refreshToken) {
            throw new AppError("Refresh token is required.", 401);
        }

        const payload = JwtUtil.verifyRefreshToken(refreshToken);

        const session =
            await this.sessionRepository.findByIdWithRefreshToken(
                payload.sessionId,
            );

        if (!session) {
            throw new AppError("Session not found.", 401);
        }

        if (session.status !== SessionStatus.ACTIVE) {
            throw new AppError("Session has been revoked.", 401);
        }

        if (session.expiresAt.getTime() <= Date.now()) {
            await this.sessionRepository.revoke(payload.sessionId);

            throw new AppError("Session has expired.", 401);
        }

        if (session.userId.toString() !== payload.sub) {
            throw new AppError("Invalid session.", 401);
        }
        console.log(session.refreshTokenVersion)
        console.log(payload.version)

        if (session.refreshTokenVersion !== payload.version) {
            throw new AppError(
                "Refresh token has already been used.",
                401,
            );
        }

        if (!session.refreshTokenHash) {
            throw new AppError("Invalid refresh token.", 401);
        }

        const incomingHash = CryptoUtil.hashToken(refreshToken);

        if (incomingHash !== session.refreshTokenHash) {
            throw new AppError("Invalid refresh token.", 401);
        }

        const nextVersion = session.refreshTokenVersion + 1;

        const accessToken = JwtUtil.generateAccessToken(
            payload.sub,
            payload.sessionId,
        );

        const newRefreshToken = JwtUtil.generateRefreshToken(
            payload.sub,
            payload.sessionId,
            nextVersion,
        );

        const newRefreshTokenHash =
            CryptoUtil.hashToken(newRefreshToken);

        const updatedSession =
            await this.sessionRepository.updateRefreshToken(
                payload.sessionId,
                newRefreshTokenHash,
                nextVersion,
                ipAddress,
            );

        if (!updatedSession) {
            throw new AppError(
                "Unable to refresh session.",
                401,
            );
        }

        return {
            userId: session.userId.toString(),
            sessionId: payload.sessionId,
            accessToken,
            refreshToken: newRefreshToken,
            accessTokenExpiresAt: this.getJwtExpiry(accessToken),
            refreshTokenExpiresAt: session.expiresAt,
        };
    }

    async logout(sessionId: string): Promise<void> {
        const session =
            await this.sessionRepository.findActiveById(sessionId);

        if (!session) {
            return;
        }

        await this.sessionRepository.revoke(sessionId);
    }

    async logoutAll(userId: string): Promise<void> {
        await this.sessionRepository.revokeAllByUserId(userId);
    }

    async getUserSessions(userId: string) {
        return this.sessionRepository.findActiveByUserId(userId);
    }

    private getRefreshTokenExpiry(): Date {
        const expiresIn =
            AUTH_CONSTANTS.REFRESH_TOKEN.EXPIRES_IN;

        return new Date(
            Date.now() + this.parseDuration(expiresIn),
        );
    }

    private getJwtExpiry(token: string): Date {
        try {
            const parts = token.split(".");

            if (parts.length !== 3) {
                throw new Error("Invalid JWT format.");
            }

            const payloadJson = Buffer
                .from(parts[1], "base64url")
                .toString("utf8");

            const payload = JSON.parse(payloadJson) as {
                exp?: number;
            };

            if (typeof payload.exp !== "number") {
                throw new Error(
                    "JWT expiration is missing.",
                );
            }

            return new Date(payload.exp * 1000);
        } catch {
            throw new AppError(
                "Unable to determine token expiration.",
                500,
            );
        }
    }

    private parseDuration(
        duration: string | number,
    ): number {
        if (typeof duration === "number") {
            return duration * 1000;
        }

        const match = duration.match(
            /^(\d+)\s*(s|m|h|d|w)$/i,
        );

        if (!match) {
            throw new Error(
                `Invalid JWT duration: ${duration}`,
            );
        }

        const value = Number(match[1]);
        const unit = match[2].toLowerCase();

        const multipliers: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
        };

        return value * multipliers[unit];
    }
}
