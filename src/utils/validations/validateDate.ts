import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateDate =
    (
        field: string,
        location: "body" | "query" | "params" = "body"
    ) =>
        (req: Request, res: Response, next: NextFunction) => {
            const value = req[location]?.[field];

            if (!value) {
                return next(
                    new AppError(
                        ValidationMessages.FIELD_REQUIRED(field),
                        400
                    )
                );
            }

            const date = new Date(value);
            if (isNaN(date.getTime())) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_DATE(field),
                        400
                    )
                );
            }

            next();
        };