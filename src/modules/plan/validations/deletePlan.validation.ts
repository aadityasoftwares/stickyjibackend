import type { Request, Response, NextFunction } from "express";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const deletePlanValidation = (req: Request, res: Response, next: NextFunction) => {
    if (!req.params.id && req.body?.id) {
        req.params.id = String(req.body.id);
    }
    return validateId(req, res, next);
};