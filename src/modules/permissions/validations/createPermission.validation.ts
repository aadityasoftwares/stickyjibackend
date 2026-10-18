import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { PermissionMessages } from "../constants/permission.messages.js";

import { PermissionValidation } from "./permission.validation.js";

export const createPermissionValidation = (req: Request, res: Response, next: NextFunction) => {
    const { name, displayName, code, module, action, access, isActive, sortOrder } = req.body;

    if (!name) {
        return next(new AppError(PermissionMessages.NAME_REQUIRED, 400));
    }

    if (!displayName) {
        return next(new AppError(PermissionMessages.DISPLAY_NAME_REQUIRED, 400));
    }

    if (!code) {
        return next(new AppError(PermissionMessages.CODE_REQUIRED, 400));
    }

    if (!module) {
        return next(new AppError(PermissionMessages.MODULE_REQUIRED, 400));
    }

    if (!action) {
        return next(new AppError(PermissionMessages.ACTION_REQUIRED, 400));
    }

    if (!PermissionValidation.actions.includes(action)) {
        return next(new AppError(PermissionMessages.INVALID_ACTION, 400));
    }

    if (access !== undefined && !PermissionValidation.accesses.includes(access)) {
        return next(new AppError(PermissionMessages.INVALID_ACCESS, 400));
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
        return next(new AppError(PermissionMessages.INVALID_STATUS, 400));
    }

    if (sortOrder !== undefined && typeof sortOrder !== "number") {
        return next(new AppError(PermissionMessages.INVALID_SORT_ORDER, 400));
    }

    next();
};
