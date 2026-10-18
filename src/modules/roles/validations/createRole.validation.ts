import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleMessages } from "../constants/role.messages.js";
import { RoleScope, RoleType } from "../constants/role.enums.js";

export const createRoleValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError("Invalid request body.", 400));
        }

        const { name, displayName, code, type, scope, workspaceId, permissions, priority, isActive } =
            req.body;

        if (name === undefined || name === null || typeof name !== "string" || name.trim().length === 0) {
            return next(new AppError(RoleMessages.NAME_REQUIRED, 400));
        }

        if (
            displayName === undefined ||
            displayName === null ||
            typeof displayName !== "string" ||
            displayName.trim().length === 0
        ) {
            return next(new AppError(RoleMessages.DISPLAY_NAME_REQUIRED, 400));
        }

        if (code === undefined || code === null || typeof code !== "string" || code.trim().length === 0) {
            return next(new AppError(RoleMessages.CODE_REQUIRED, 400));
        }

        const resolvedScope = scope ?? RoleScope.WORKSPACE;
        if (!Object.values(RoleScope).includes(resolvedScope)) {
            return next(new AppError(RoleMessages.INVALID_SCOPE, 400));
        }

        if (resolvedScope === RoleScope.WORKSPACE) {
            if (!workspaceId) {
                return next(new AppError(RoleMessages.WORKSPACE_REQUIRED, 400));
            }
            if (typeof workspaceId !== "string" || !Types.ObjectId.isValid(workspaceId)) {
                return next(new AppError(RoleMessages.INVALID_WORKSPACE, 400));
            }
        }

        if (type !== undefined && !Object.values(RoleType).includes(type)) {
            return next(new AppError(RoleMessages.INVALID_TYPE, 400));
        }

        if (permissions !== undefined) {
            if (!Array.isArray(permissions)) {
                return next(new AppError(RoleMessages.INVALID_PERMISSIONS, 400));
            }
            for (const pid of permissions) {
                const idStr =
                    typeof pid === "object" && pid !== null && "_id" in pid
                        ? String((pid as any)._id)
                        : String(pid);
                if (!Types.ObjectId.isValid(idStr)) {
                    return next(new AppError(RoleMessages.INVALID_PERMISSION, 400));
                }
            }
        }

        if (priority !== undefined && (typeof priority !== "number" || isNaN(priority) || priority < 0)) {
            return next(new AppError("Priority must be a non-negative number.", 400));
        }

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(RoleMessages.INVALID_STATUS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
