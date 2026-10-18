import type { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/app.error.js";

export const requireRouteParam = (paramName: string) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.params[paramName]) {
        return next(new AppError(`${paramName} is required.`, 400));
    }

    next();
};
