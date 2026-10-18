import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmailValue = (value: unknown, field: string = "email"): string => {
    if (value === undefined || value === null || value === "") {
        throw new AppError(ValidationMessages.FIELD_REQUIRED(field), 400);
    }

    if (typeof value !== "string") {
        throw new AppError(ValidationMessages.INVALID_EMAIL, 400);
    }

    const email = value.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
        throw new AppError(ValidationMessages.INVALID_EMAIL, 400);
    }

    return email;
};

export const validateEmail =
    (field: string = "email", location: "body" | "query" | "params" = "body") =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            const value = req[location]?.[field];

            req[location][field] = validateEmailValue(value, field);

            next();
        } catch (error) {
            next(error);
        }
    };
