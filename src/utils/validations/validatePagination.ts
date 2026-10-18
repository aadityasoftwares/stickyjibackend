import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validatePagination =
    (
        defaultPage: number = 1,
        defaultLimit: number = 10,
        maxLimit: number = 100
    ) =>
        (req: Request, res: Response, next: NextFunction) => {
            const page = req.query.page ? Number(req.query.page) : defaultPage;
            const limit = req.query.limit ? Number(req.query.limit) : defaultLimit;

            if (isNaN(page) || page < 1) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_PAGINATION_PAGE,
                        400
                    )
                );
            }

            if (isNaN(limit) || limit < 1 || limit > maxLimit) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_PAGINATION_LIMIT(maxLimit),
                        400
                    )
                );
            }

            req.query.page = String(page);
            req.query.limit = String(limit);

            next();
        };