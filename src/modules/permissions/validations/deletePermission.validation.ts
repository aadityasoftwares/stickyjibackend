import type { Request, Response, NextFunction } from "express";

import { Types } from "mongoose";

import { AppError } from "../../../utils/errors/app.error.js";

export const deletePermissionValidation = (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id ?? req.body?.id;

    if (!id || !Types.ObjectId.isValid(String(id))) {
        return next(new AppError("Invalid permission id.", 400));
    }

    next();
};
