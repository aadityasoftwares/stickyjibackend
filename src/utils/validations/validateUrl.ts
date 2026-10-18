import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateUrl =
    (field: string, location: "body" | "query" | "params" = "body") =>
    (req: Request, res: Response, next: NextFunction) => {
        const urlValue = req[location]?.[field];

        if (!urlValue) {
            return next(new AppError(ValidationMessages.FIELD_REQUIRED(field), 400));
        }

        try {
            new URL(urlValue);
        } catch {
            return next(new AppError(ValidationMessages.INVALID_URL(field), 400));
        }

        next();
    };
