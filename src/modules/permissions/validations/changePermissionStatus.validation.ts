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

export const changePermissionStatusValidation =
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

        if (
            typeof req.body
                .isActive !==
            "boolean"
        ) {
            return next(
                new AppError(
                    PermissionMessages.INVALID_STATUS,
                    400
                )
            );
        }

        next();
    };