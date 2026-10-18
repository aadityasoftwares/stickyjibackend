import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleMessages } from "../constants/role.messages.js";

const IMMUTABLE_FIELDS = ["type", "scope", "workspaceId", "isSystem", "isDefault", "priority"] as const;

export const updateRoleValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const id = req.params?.id ?? req.body?.id;
        if (!id || typeof id !== "string" || !Types.ObjectId.isValid(id.trim())) {
            return next(new AppError(RoleMessages.NOT_FOUND, 404));
        }

        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(RoleMessages.UPDATE_REQUIRED, 400));
        }

        const bodyKeys = Object.keys(req.body).filter((k) => k !== "id");
        if (bodyKeys.length === 0) {
            return next(new AppError(RoleMessages.UPDATE_REQUIRED, 400));
        }

        const containsImmutable = IMMUTABLE_FIELDS.some((field) =>
            Object.prototype.hasOwnProperty.call(req.body, field),
        );

        if (containsImmutable) {
            return next(new AppError(RoleMessages.IMMUTABLE_FIELDS, 400));
        }

        const { name, displayName, code, description, permissions, isActive } = req.body;

        if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
            return next(new AppError(RoleMessages.NAME_REQUIRED, 400));
        }

        if (
            displayName !== undefined &&
            (typeof displayName !== "string" || displayName.trim().length === 0)
        ) {
            return next(new AppError(RoleMessages.DISPLAY_NAME_REQUIRED, 400));
        }

        if (code !== undefined && (typeof code !== "string" || code.trim().length === 0)) {
            return next(new AppError(RoleMessages.CODE_REQUIRED, 400));
        }

        if (description !== undefined && typeof description !== "string") {
            return next(new AppError("Description must be a string.", 400));
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

        if (isActive !== undefined && typeof isActive !== "boolean") {
            return next(new AppError(RoleMessages.INVALID_STATUS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
