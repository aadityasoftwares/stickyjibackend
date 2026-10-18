import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateCode =
    (
        field: string,
        source: "body" | "query" | "params" = "body",
        required = true,
        minLength = 2,
        maxLength = 100,
    ) =>
    (req: Request, res: Response, next: NextFunction) => {
        const value = req[source][field];

        if (value === undefined || value === null || value === "") {
            if (!required) {
                return next();
            }

            return next();
        }

        if (typeof value !== "string") {
            return next(new AppError(ValidationMessages.INVALID_CODE(field), 400));
        }

        const code = value.trim();

        if (code.length < minLength || code.length > maxLength) {
            return next(
                new AppError(ValidationMessages.INVALID_CODE_LENGTH(field, minLength, maxLength), 400),
            );
        }

        const regex = /^(?!_)(?!.*__)[A-Z0-9_]+(?<!_)$/;

        if (!regex.test(code)) {
            return next(new AppError(ValidationMessages.INVALID_CODE(field), 400));
        }

        next();
    };
