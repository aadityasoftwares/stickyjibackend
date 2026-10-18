import type { Request, Response, NextFunction } from "express";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const getUserProfileValidation = (req: Request, res: Response, next: NextFunction) => {
    if (!req.params.id) {
        return next();
    }

    return validateId(req, res, next);
};
