import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { validateEmailValue } from "../../../utils/validations/validateEmail.js";
import { SessionType } from "../constants/session.constants.js";
import { AuthMessages } from "../constants/auth.messages.js";

export const loginValidation = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {

        const {
            email,
            password,
            deviceId,
            deviceName,
            sessionType,
        } = req.body;

        req.body.email = validateEmailValue(email, "email");

        if (password === undefined || password === null) {
            throw new AppError(AuthMessages.PASSWORD_REQUIRED, 400);
        }

        if (typeof password !== "string" || !password) {
            throw new AppError(AuthMessages.INVALID_PASSWORD, 400);
        }

        if (deviceId !== undefined && deviceId !== null) {
            if (typeof deviceId !== "string" || !deviceId.trim()) {
                throw new AppError(
                    AuthMessages.DEVICE_ID_INVALID,
                    400
                );
            }

            req.body.deviceId = deviceId.trim();
        }

        if (deviceName !== undefined && deviceName !== null) {
            if (typeof deviceName !== "string" || !deviceName.trim()) {
                throw new AppError(
                    AuthMessages.DEVICE_NAME_INVALID,
                    400
                );
            }

            const normalizedDeviceName = deviceName.trim();

            if (normalizedDeviceName.length > 200) {
                throw new AppError(
                    "Device name cannot exceed 200 characters.",
                    400
                );
            }

            req.body.deviceName = normalizedDeviceName;
        }

        if (sessionType !== undefined && sessionType !== null) {
            if (
                typeof sessionType !== "string" ||
                !Object.values(SessionType).includes(
                    sessionType as SessionType
                )
            ) {
                throw new AppError(
                    AuthMessages.SESSION_TYPE_INVALID,
                    400
                );
            }

            req.body.sessionType = sessionType;
        }

        next();
    } catch (error) {
        next(error);
    }
};