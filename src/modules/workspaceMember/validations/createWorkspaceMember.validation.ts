import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { createWorkspaceMemberSchema } from "./workspaceMember.schema.js";

export const createWorkspaceMemberValidation = (req: Request, _res: Response, next: NextFunction) => {
    const result = createWorkspaceMemberSchema.safeParse(req.body);
    if (!result.success)
        return next(
            new AppError(
                result.error.issues[0]?.message ?? WorkspaceMemberMessages.UNSUPPORTED_CREATE_FIELDS,
                400,
            ),
        );
    req.body = result.data;
    next();
};
