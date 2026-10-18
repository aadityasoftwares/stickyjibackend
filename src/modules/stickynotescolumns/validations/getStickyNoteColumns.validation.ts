import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

export const getStickyNoteColumnsValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const source = req.method === "POST" ? (req.body ?? {}) : req.query;
        const workspaceId = source.workspaceId ?? req.query.workspaceId;
        const workspaceFolderId = source.workspaceFolderId ?? req.query.workspaceFolderId;

        if (typeof workspaceId !== "string" || !StickyNoteColumnValidation.isValidObjectId(workspaceId)) {
            return next(new AppError(
                workspaceId === undefined
                    ? StickyNoteColumnMessages.WORKSPACE_ID_REQUIRED
                    : StickyNoteColumnMessages.INVALID_WORKSPACE_ID,
                400,
            ));
        }

        if (typeof workspaceFolderId !== "string" || !StickyNoteColumnValidation.isValidObjectId(workspaceFolderId)) {
            return next(new AppError(
                workspaceFolderId === undefined
                    ? StickyNoteColumnMessages.WORKSPACE_FOLDER_ID_REQUIRED
                    : StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID,
                400,
            ));
        }

        next();
    } catch (error) {
        next(error);
    }
};
