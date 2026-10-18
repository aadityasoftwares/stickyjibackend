import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { PermissionMessages } from "../constants/permission.messages.js";
import { PermissionValidation } from "./permission.validation.js";

export const getPermissionsValidation = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const source = (req.method === "POST" ? req.body : req.query) ?? {};
        const { page, limit, search, module: moduleName, action, access, isActive, isSystem, sortOrder, sortBy } = source;

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

        if (action !== undefined && !PermissionValidation.actions.includes(action as any)) {
            return next(new AppError(PermissionMessages.INVALID_ACTION, 400));
        }

        if (access !== undefined && !PermissionValidation.accesses.includes(access as any)) {
            return next(new AppError(PermissionMessages.INVALID_ACCESS, 400));
        }

        if (
            isActive !== undefined &&
            typeof isActive !== "boolean" &&
            isActive !== "true" &&
            isActive !== "false"
        ) {
            return next(new AppError(PermissionMessages.INVALID_STATUS, 400));
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

        if (moduleName !== undefined && typeof moduleName !== "string") {
            return next(new AppError("Module must be a string.", 400));
        }

        if (sortBy !== undefined && typeof sortBy !== "string") {
            return next(new AppError("SortBy must be a string.", 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
