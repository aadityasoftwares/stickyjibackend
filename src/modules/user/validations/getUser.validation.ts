import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserMessages } from "../constants/user.messages.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";

export const getUserValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.params.id) {
        return validateId(req, res, next);
    }

    const email = RequestUtil.getParam(req.params.email);

    if (!email) {
        return next(new AppError(UserMessages.EMAIL_REQUIRED, 400));
    }

    if (!email.includes("@")) {
        return next(new AppError(UserMessages.INVALID_EMAIL, 400));
    }

    next();
};
