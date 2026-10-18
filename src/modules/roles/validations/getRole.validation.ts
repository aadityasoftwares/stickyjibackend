import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleMessages } from "../constants/role.messages.js";

export const getRoleValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const id = req.params?.id ?? req.query?.id;
        const code = req.params?.code ?? req.query?.code;

        if (id) {
            if (typeof id !== "string" || !Types.ObjectId.isValid(id.trim())) {
                return next(new AppError(RoleMessages.NOT_FOUND, 404));
            }
        } else if (code) {
            if (typeof code !== "string" || code.trim().length === 0) {
                return next(new AppError(RoleMessages.CODE_REQUIRED, 400));
            }
        } else {
            return next(new AppError(RoleMessages.NOT_FOUND, 404));
        }

        const workspaceId = req.query?.workspaceId ?? req.body?.workspaceId;
        if (workspaceId !== undefined) {
            if (typeof workspaceId !== "string" || !Types.ObjectId.isValid(workspaceId.trim())) {
                return next(new AppError(RoleMessages.INVALID_WORKSPACE, 400));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};
