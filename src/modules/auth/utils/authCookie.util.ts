import type { Response } from "express";
import { AUTH_COOKIE_CONSTANTS } from "../constants/authCookie.constants.js";

export class AuthCookieUtil {
    static setRefreshToken(res: Response, refreshToken: string, expiresAt: Date): void {
        res.cookie(AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_NAME, refreshToken, {
            ...AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_OPTIONS,
            expires: expiresAt,
        });
    }

    static clearRefreshToken(res: Response): void {
        res.clearCookie(
            AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_NAME,
            AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_OPTIONS,
        );
    }
}
