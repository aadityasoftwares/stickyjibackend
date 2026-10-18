import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuthMessages } from "../constants/auth.messages.js";

export const refreshTokenValidation = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken === undefined || refreshToken === null) {
            throw new AppError(AuthMessages.REFRESH_TOKEN_REQUIRED, 400);
        }

        if (typeof refreshToken !== "string" || !refreshToken.trim()) {
            throw new AppError(AuthMessages.INVALID_REFRESH_TOKEN, 400);
        }

        req.body.refreshToken = refreshToken.trim();

        next();
    } catch (error) {
        next(error);
    }
};
