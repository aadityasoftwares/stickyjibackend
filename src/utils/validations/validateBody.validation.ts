import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/app.error.js";

export const requireBodyFields =
    (...fields: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
        for (const field of fields) {
            if (req.body[field] === undefined || req.body[field] === null || req.body[field] === "") {
                return next(new AppError(`${field} is required.`, 400));
            }
        }

        next();
    };
