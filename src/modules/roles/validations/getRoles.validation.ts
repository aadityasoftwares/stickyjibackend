import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleMessages } from "../constants/role.messages.js";
import { RoleScope, RoleType } from "../constants/role.enums.js";

export const getRolesValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const source = (req.method === "POST" ? req.body : req.query) ?? {};
        const { workspaceId, page, limit, type, scope, isActive, isSystem, sortOrder, search, sortBy } = source;

        if (workspaceId !== undefined) {
            if (typeof workspaceId !== "string" || !Types.ObjectId.isValid(workspaceId.trim())) {
                return next(new AppError(RoleMessages.INVALID_WORKSPACE, 400));
            }
        }

        if (page !== undefined) {
            const pageNum = Number(page);
            if (isNaN(pageNum) || pageNum < 1) {
                return next(new AppError("Page must be a positive integer.", 400));
            }
        }

        if (limit !== undefined) {
            const limitNum = Number(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return next(new AppError("Limit must be an integer between 1 and 100.", 400));
            }
        }

        if (type !== undefined && !Object.values(RoleType).includes(type as any)) {
            return next(new AppError(RoleMessages.INVALID_TYPE, 400));
        }

        if (scope !== undefined && !Object.values(RoleScope).includes(scope as any)) {
            return next(new AppError(RoleMessages.INVALID_SCOPE, 400));
        }

        if (
            isActive !== undefined &&
            typeof isActive !== "boolean" &&
            isActive !== "true" &&
            isActive !== "false"
        ) {
            return next(new AppError(RoleMessages.INVALID_STATUS, 400));
        }

        if (
            isSystem !== undefined &&
            typeof isSystem !== "boolean" &&
            isSystem !== "true" &&
            isSystem !== "false"
        ) {
            return next(new AppError("isSystem must be true or false.", 400));
        }

        if (sortOrder !== undefined && sortOrder !== "asc" && sortOrder !== "desc") {
            return next(new AppError("Sort order must be asc or desc.", 400));
        }

        if (search !== undefined && typeof search !== "string") {
            return next(new AppError("Search must be a string.", 400));
        }

        if (sortBy !== undefined && typeof sortBy !== "string") {
            return next(new AppError("SortBy must be a string.", 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
