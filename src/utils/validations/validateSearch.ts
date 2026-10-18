import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateSearch =
    (
        field: string = "search",
        minLength: number = 1,
        maxLength: number = 100
    ) =>
        (req: Request, res: Response, next: NextFunction) => {
            const searchTerm = req.query[field];

            if (searchTerm === undefined) {
                return next();
            }

            if (typeof searchTerm !== "string") {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_SEARCH_QUERY,
                        400
                    )
                );
            }

            const trimmed = searchTerm.trim();
            if (trimmed.length < minLength || trimmed.length > maxLength) {
                return next(
                    new AppError(
                        ValidationMessages.SEARCH_LENGTH_INVALID(minLength, maxLength),
                        400
                    )
                );
            }

            next();
        };