import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { folderListSchema, folderIdSchema } from "./workspaceFolder.schema.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { WorkspaceFolderMessages } from "../constants/workspaceFolder.messages.js";
const validate = validateUsingZOD(folderListSchema);
export const getAllWorkspaceFoldersValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
        req.body = {
            ...req.query,
            ...(req.query.isDefault === "true" || req.query.isDefault === "false"
                ? { isDefault: req.query.isDefault === "true" }
                : {}),
        };
    } else req.body ??= {};
    if (req.params.workspaceId !== undefined) {
        const id = folderIdSchema.safeParse(req.params.workspaceId);
        if (!id.success) return next(new AppError(WorkspaceFolderMessages.INVALID_WORKSPACE_ID, 400));
        if (req.body.workspaceId !== undefined && req.body.workspaceId !== id.data) {
            return next(new AppError(WorkspaceFolderMessages.WORKSPACE_MISMATCH, 400));
        }
        req.body = { ...req.body, workspaceId: id.data };
    }
    return validate(req, res, next);
};
