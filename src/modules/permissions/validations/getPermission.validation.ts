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

export const getPermissionValidation =
    (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const code =
            req.params.code ??
            req.query.code;

        if (code) {
            return next();
        }

        const id =
            req.params.id ??
            req.query.id;

        if (!id) {
            return next(
                new AppError(
                    "Permission id is required.",
                    400
                )
            );
        }

        if (
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

        next();
    };