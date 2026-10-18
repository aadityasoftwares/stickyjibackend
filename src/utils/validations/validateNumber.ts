import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

interface NumberOptions {
    min?: number;
    max?: number;
    location?: "body" | "query" | "params";
}

export const validateNumber =
    (
        field: string,
        options: NumberOptions = {}
    ) =>
        (req: Request, res: Response, next: NextFunction) => {
            const location = options.location || "body";
            const value = req[location]?.[field];

            if (value === undefined || value === null || value === "") {
                return next(
                    new AppError(
                        ValidationMessages.FIELD_REQUIRED(field),
                        400
                    )
                );
            }

            const num = Number(value);
            if (isNaN(num)) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_NUMBER(field),
                        400
                    )
                );
            }

            if (options.min !== undefined && num < options.min) {
                return next(
                    new AppError(
                        ValidationMessages.MIN_VALUE(field, options.min),
                        400
                    )
                );
            }

            if (options.max !== undefined && num > options.max) {
                return next(
                    new AppError(
                        ValidationMessages.MAX_VALUE(field, options.max),
                        400
                    )
                );
            }

            next();
        };