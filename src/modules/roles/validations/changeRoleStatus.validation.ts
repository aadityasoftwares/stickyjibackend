import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleMessages } from "../constants/role.messages.js";

export const changeRoleStatusValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const id = req.params?.id ?? req.body?.id;
        if (!id || typeof id !== "string" || !Types.ObjectId.isValid(id.trim())) {
            return next(new AppError(RoleMessages.NOT_FOUND, 404));
        }

        if (typeof req.body?.isActive !== "boolean") {
            return next(new AppError(RoleMessages.INVALID_STATUS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
