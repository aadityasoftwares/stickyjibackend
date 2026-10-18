import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateEnum =
    (
        field: string,
        allowedValues: readonly string[] | string[],
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

            if (!allowedValues.includes(value)) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_ENUM(
                            field,
                            allowedValues.join(", ")
                        ),
                        400
                    )
                );
            }

            next();
        };