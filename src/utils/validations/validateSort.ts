import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateSort =
    (allowedFields: string[], field: string = "sortBy", orderField: string = "sortOrder") =>
    (req: Request, res: Response, next: NextFunction) => {
        const sortBy = req.query[field] as string | undefined;
        const sortOrder = req.query[orderField] as string | undefined;

        if (sortBy && !allowedFields.includes(sortBy)) {
            return next(new AppError(ValidationMessages.INVALID_SORT_FIELD(allowedFields.join(", ")), 400));
        }

        if (sortOrder && !["asc", "desc", "1", "-1"].includes(sortOrder.toLowerCase())) {
            return next(new AppError(ValidationMessages.INVALID_SORT_ORDER, 400));
        }

        next();
    };
