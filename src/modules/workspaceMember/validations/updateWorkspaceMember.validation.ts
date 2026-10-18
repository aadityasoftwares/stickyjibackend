import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { updateWorkspaceMemberSchema } from "./workspaceMember.schema.js";

export const updateWorkspaceMemberValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: unknown) => {
        if (error) return next(error);
        const result = updateWorkspaceMemberSchema.safeParse(req.body);
        if (!result.success)
            return next(
                new AppError(result.error.issues[0]?.message ?? WorkspaceMemberMessages.UNSUPPORTED_UPDATE_FIELDS, 400),
            );
        req.body = result.data;
        next();
    });
};
