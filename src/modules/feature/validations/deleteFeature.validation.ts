import type { Request, Response, NextFunction, } from "express";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const deleteFeatureValidation = (req: Request, res: Response, next: NextFunction) => {
    return validateId(req, res, next);
};