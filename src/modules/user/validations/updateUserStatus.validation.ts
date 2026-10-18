import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserMessages } from "../constants/user.messages.js";
import { UserValidation } from "./user.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateUserStatusValidation = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    validateId(req, res, (error?: any) => {
        if (error) {
            return next(error);
        }

        const { status } = req.body;

        if (!status) {
            return next(
                new AppError(
                    UserMessages.STATUS_REQUIRED,
                    400
                )
            );
        }

        if (!UserValidation.statuses.includes(status)) {
            return next(
                new AppError(
                    UserMessages.INVALID_STATUS,
                    400
                )
            );
        }

        next();
    });
};