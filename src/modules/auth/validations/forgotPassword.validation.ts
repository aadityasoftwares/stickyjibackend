import type { Request, Response, NextFunction } from "express";
import { validateEmailValue } from "../../../utils/validations/validateEmail.js";

export const forgotPasswordValidation = (req: Request, res: Response, next: NextFunction): void => {
    try {
        req.body.email = validateEmailValue(req.body.email, "email");

        next();
    } catch (error) {
        next(error);
    }
};
