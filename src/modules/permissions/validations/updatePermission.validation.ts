import type {
    Request,
    Response,
    NextFunction,
} from "express";

import {
    Types,
} from "mongoose";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    PermissionMessages,
} from "../constants/permission.messages.js";

import {
    PermissionValidation,
} from "./permission.validation.js";

export const updatePermissionValidation =
    (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const id =
            req.params.id ??
            req.body?.id;

        if (
            !id ||
            !Types.ObjectId.isValid(
                String(id)
            )
        ) {
            return next(
                new AppError(
                    "Invalid permission id.",
                    400
                )
            );
        }

        const updateFields =
            Object.keys(
                req.body
            ).filter(
                (
                    key
                ) =>
                    key !==
                    "id"
            );

        if (
            updateFields.length ===
            0
        ) {
            return next(
                new AppError(
                    PermissionMessages.UPDATE_REQUIRED,
                    400
                )
            );
        }

        const {
            action,
            access,
            isActive,
            sortOrder,
        } =
            req.body;

        if (
            action !==
            undefined &&
            !PermissionValidation
                .actions
                .includes(
                    action
                )
        ) {
            return next(
                new AppError(
                    PermissionMessages.INVALID_ACTION,
                    400
                )
            );
        }

        if (
            access !==
            undefined &&
            !PermissionValidation
                .accesses
                .includes(
                    access
                )
        ) {
            return next(
                new AppError(
                    PermissionMessages.INVALID_ACCESS,
                    400
                )
            );
        }

        if (
            isActive !==
            undefined &&
            typeof isActive !==
            "boolean"
        ) {
            return next(
                new AppError(
                    PermissionMessages.INVALID_STATUS,
                    400
                )
            );
        }

        if (
            sortOrder !==
            undefined &&
            typeof sortOrder !==
            "number"
        ) {
            return next(
                new AppError(
                    PermissionMessages.INVALID_SORT_ORDER,
                    400
                )
            );
        }

        next();
    };