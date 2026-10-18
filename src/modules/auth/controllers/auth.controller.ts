import type { Request, Response, NextFunction } from "express";

import { AuthService } from "../services/auth.service.js";
import { AuthMessages } from "../constants/auth.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AUTH_COOKIE_CONSTANTS } from "../constants/authCookie.constants.js";
import { AuthCookieUtil } from "../utils/authCookie.util.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

export class AuthController {
    private getAuditContext(req: Request): IAuditLogContext {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    private readonly authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.authService.register(req.body, this.getAuditContext(req));

            AuthCookieUtil.setRefreshToken(res, result.refreshToken, result.refreshTokenExpiresAt);

            return res.status(201).json(ResponseUtil.created(AuthMessages.REGISTERED, result.data));
        } catch (error) {
            next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.authService.login(req.body, this.getAuditContext(req));

            AuthCookieUtil.setRefreshToken(res, result.refreshToken, result.refreshTokenExpiresAt);

            return res.status(200).json(ResponseUtil.success(AuthMessages.LOGIN_SUCCESS, result.data));
        } catch (error) {
            next(error);
        }
    };

    refreshToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const refreshToken = req.cookies?.[AUTH_COOKIE_CONSTANTS.REFRESH_TOKEN_NAME];
            if (typeof refreshToken !== "string" || !refreshToken.trim()) {
                throw new AppError(AuthMessages.INVALID_REFRESH_TOKEN, 401);
            }

            const result = await this.authService.refreshToken(refreshToken, this.getAuditContext(req));

            AuthCookieUtil.setRefreshToken(res, result.refreshToken, result.refreshTokenExpiresAt);

            return res.status(200).json(ResponseUtil.success(AuthMessages.REFRESH_SUCCESS, result.data));
        } catch (error) {
            /*
             * IMPORTANT:
             *
             * Do not clear the refresh-token cookie here.
             *
             * Refresh tokens may be rotated. If multiple
             * refresh requests happen at nearly the same
             * time, one request can successfully rotate
             * the token while another request fails using
             * the older token.
             *
             * Clearing the cookie from the failed request
             * could delete the newly-issued valid token.
             */
            next(error);
        }
    };

    verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.authService.verifyEmail(req.body.token, this.getAuditContext(req));

            return res.status(200).json(ResponseUtil.success(AuthMessages.EMAIL_VERIFICATION_SUCCESS));
        } catch (error) {
            next(error);
        }
    };

    resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.authService.resendVerificationEmail(req.body.email, this.getAuditContext(req));

            return res.status(200).json(ResponseUtil.success(AuthMessages.EMAIL_VERIFICATION_SENT));
        } catch (error) {
            next(error);
        }
    };

    forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.authService.forgotPassword(req.body.email, this.getAuditContext(req));

            return res.status(200).json(ResponseUtil.success(AuthMessages.PASSWORD_RESET_EMAIL_SENT));
        } catch (error) {
            next(error);
        }
    };

    resetPassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.authService.resetPassword(
                req.body.token,
                req.body.password,
                this.getAuditContext(req),
            );

            /*
             * Password reset invalidates existing
             * authentication sessions.
             */
            AuthCookieUtil.clearRefreshToken(res);

            return res.status(200).json(ResponseUtil.success(AuthMessages.PASSWORD_RESET_SUCCESS));
        } catch (error) {
            next(error);
        }
    };

    changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = RequestUtil.getUserId(req);

            await this.authService.changePassword(
                userId,
                req.body.currentPassword,
                req.body.newPassword,
                this.getAuditContext(req),
            );

            /*
             * Password change invalidates existing
             * authentication sessions.
             */
            AuthCookieUtil.clearRefreshToken(res);

            return res.status(200).json(ResponseUtil.success(AuthMessages.PASSWORD_CHANGED));
        } catch (error) {
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const sessionId = RequestUtil.getParam(req.user?.sessionId);

            await this.authService.logout(sessionId, this.getAuditContext(req));

            AuthCookieUtil.clearRefreshToken(res);

            return res.status(200).json(ResponseUtil.success(AuthMessages.LOGOUT_SUCCESS));
        } catch (error) {
            /*
             * Even if backend logout fails, remove the
             * browser-side refresh cookie because the
             * user explicitly requested logout.
             */
            AuthCookieUtil.clearRefreshToken(res);

            next(error);
        }
    };

    logoutAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = RequestUtil.getUserId(req);

            await this.authService.logoutAll(userId, this.getAuditContext(req));

            AuthCookieUtil.clearRefreshToken(res);

            return res.status(200).json(ResponseUtil.success(AuthMessages.LOGOUT_ALL_SUCCESS));
        } catch (error) {
            /*
             * User explicitly requested logout-all,
             * therefore remove this browser's cookie
             * even if the server operation fails.
             */
            AuthCookieUtil.clearRefreshToken(res);

            next(error);
        }
    };

    getSessions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = RequestUtil.getUserId(req);

            const sessions = await this.authService.getSessions(userId);

            return res.status(200).json(ResponseUtil.success(AuthMessages.SESSIONS_FETCHED, sessions));
        } catch (error) {
            next(error);
        }
    };
}
