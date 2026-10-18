import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { AuthMessages } from "../constants/auth.messages.js";

export const verifyEmailValidation = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const { token } = req.body;

        if (token === undefined || token === null) {
            throw new AppError(
                "Email verification token is required.",
                400
            );
        }

        if (typeof token !== "string" || !token.trim()) {
            throw new AppError(
                AuthMessages.INVALID_EMAIL_VERIFICATION_TOKEN,
                400
            );
        }

        req.body.token = token.trim();

        next();
    } catch (error) {
        next(error);
    }
};