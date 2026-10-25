import type { Request, Response, NextFunction } from "express";

import { JwtUtil } from "../../modules/auth/utils/jwt.util.js";
import { ResponseUtil } from "../../utils/response.util.js";
import { AUTH_COOKIE_CONSTANTS } from "../../modules/auth/constants/authCookie.constants.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                sessionId: string;
            };
        }
    }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json(ResponseUtil.unauthorized("Unauthorized: No token provided"));
        }

        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json(ResponseUtil.unauthorized("Unauthorized: No token provided"));
        }

        let payload;

        try {
            payload = JwtUtil.verifyAccessToken(token);
        } catch (error) {
            return res
                .status(401)
                .json(ResponseUtil.unauthorized("Unauthorized: Invalid or expired access token"));
        }

        req.user = {
            id: payload.sub,
            sessionId: payload.sessionId,
        };

        return next();
    } catch (error: any) {
        console.error("AuthMiddleware Error:", error);

        return res
            .status(500)
            .json(ResponseUtil.serverError(error.message || "Internal server error", error));
    }
};

export const logoutAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        let token = "";

        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7).trim();
        }

        if (token) {
            try {
                const payload = JwtUtil.verifyAccessToken(token);
                req.user = {
                    id: payload.sub,
                    sessionId: payload.sessionId,
                };
                return next();
            } catch {
                try {
                    const payload = JwtUtil.verifyAccessTokenIgnoreExpiration(token);
                    req.user = {
                        id: payload.sub,
                        sessionId: payload.sessionId,
                    };
                    return next();
                } catch {
                    // Ignore token decode failure and proceed
                }
            }
        }

        const cookieRefreshToken =
            (req.cookies &&
                (req.cookies[AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_NAME] ||
                    req.cookies.msn_refresh ||
                    req.cookies.__Host_msn_refresh)) ||
            (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

        if (cookieRefreshToken && typeof cookieRefreshToken === "string") {
            try {
                const refreshPayload = JwtUtil.verifyRefreshToken(cookieRefreshToken);
                req.user = {
                    id: refreshPayload.sub,
                    sessionId: refreshPayload.sessionId,
                };
                return next();
            } catch {
                // Ignore refresh token verification failure
            }
        }

        return next();
    } catch {
        return next();
    }
};

