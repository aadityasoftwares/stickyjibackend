import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { AUTH_CONSTANTS } from "../constants/auth.constants.js";
import { AuthTokenType } from "../constants/auth.enums.js";
import type { IAccessTokenPayload, IRefreshTokenPayload } from "../interfaces/auth.interface.js";

const ACCESS_SECRET: any = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET: any = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET is not configured.");
}

if (!REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET is not configured.");
}

const getJwtPayload = (decoded: string | JwtPayload): JwtPayload => {
    if (typeof decoded !== "object" || decoded === null) {
        throw new Error("Invalid JWT payload.");
    }
    return decoded;
};

export class JwtUtil {
    static generateAccessToken(userId: string, sessionId: string): string {
        const payload: IAccessTokenPayload = {
            sub: userId,
            sessionId,
            tokenType: AuthTokenType.ACCESS,
        };

        const options: SignOptions = {
            expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN.EXPIRES_IN as SignOptions["expiresIn"],
        };

        return jwt.sign(payload, ACCESS_SECRET, options);
    }

    static generateRefreshToken(userId: string, sessionId: string, version: number): string {
        const payload: IRefreshTokenPayload = {
            sub: userId,
            sessionId,
            tokenType: AuthTokenType.REFRESH,
            version,
        };

        const options: SignOptions = {
            expiresIn: AUTH_CONSTANTS.REFRESH_TOKEN.EXPIRES_IN as SignOptions["expiresIn"],
        };

        return jwt.sign(payload, REFRESH_SECRET, options);
    }

    static verifyAccessToken(token: string): IAccessTokenPayload {
        const decoded = jwt.verify(token, ACCESS_SECRET);
        const payload = getJwtPayload(decoded);

        if (typeof payload.sub !== "string") {
            throw new Error("Invalid access token subject.");
        }

        if (typeof payload.sessionId !== "string") {
            throw new Error("Invalid access token session.");
        }

        if (payload.tokenType !== AuthTokenType.ACCESS) {
            throw new Error("Invalid access token type.");
        }

        return {
            sub: payload.sub,
            sessionId: payload.sessionId,
            tokenType: AuthTokenType.ACCESS,
            ...(payload.iat !== undefined && { iat: payload.iat }),
            ...(payload.exp !== undefined && { exp: payload.exp }),
        };
    }

    static verifyRefreshToken(token: string): IRefreshTokenPayload {
        const decoded = jwt.verify(token, REFRESH_SECRET);
        const payload = getJwtPayload(decoded);

        if (typeof payload.sub !== "string") {
            throw new Error("Invalid refresh token subject.");
        }

        if (typeof payload.sessionId !== "string") {
            throw new Error("Invalid refresh token session.");
        }

        if (payload.tokenType !== AuthTokenType.REFRESH) {
            throw new Error("Invalid refresh token type.");
        }

        if (typeof payload.version !== "number") {
            throw new Error("Invalid refresh token version.");
        }

        return {
            sub: payload.sub,
            sessionId: payload.sessionId,
            tokenType: AuthTokenType.REFRESH,
            version: payload.version,
            ...(payload.iat !== undefined && { iat: payload.iat }),
            ...(payload.exp !== undefined && { exp: payload.exp }),
        };
    }
}
