import type { Request, Response, NextFunction } from "express";

export const resetAllUserPreferencesValidation = (req: Request, res: Response, next: NextFunction) => {
    next();
};
