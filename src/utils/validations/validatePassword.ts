import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validatePassword =
    (
        field: string = "password",
        minLength: number = 8
    ) =>
        (req: Request, res: Response, next: NextFunction) => {
            const password = req.body?.[field];

            if (!password) {
                return next(
                    new AppError(
                        ValidationMessages.FIELD_REQUIRED(field),
                        400
                    )
                );
            }

            if (typeof password !== "string" || password.length < minLength) {
                return next(
                    new AppError(
                        ValidationMessages.PASSWORD_TOO_SHORT(minLength),
                        400
                    )
                );
            }

            next();
        };