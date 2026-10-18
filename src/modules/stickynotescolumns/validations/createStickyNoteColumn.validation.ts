import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

const ALLOWED_FIELDS = ["workspaceId", "workspaceFolderId", "name", "color"] as const;

export const createStickyNoteColumnValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        if (!StickyNoteColumnValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        const { workspaceId, workspaceFolderId, name, color } = req.body;

        if (workspaceId === undefined || workspaceId === null) {
            return next(new AppError(StickyNoteColumnMessages.WORKSPACE_ID_REQUIRED, 400));
        }
        if (!StickyNoteColumnValidation.isValidObjectId(workspaceId)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_WORKSPACE_ID, 400));
        }

        if (workspaceFolderId === undefined || workspaceFolderId === null) {
            return next(new AppError(StickyNoteColumnMessages.WORKSPACE_FOLDER_ID_REQUIRED, 400));
        }
        if (!StickyNoteColumnValidation.isValidObjectId(workspaceFolderId)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID, 400));
        }

        if (name === undefined || name === null) {
            return next(new AppError(StickyNoteColumnMessages.NAME_REQUIRED, 400));
        }
        if (!StickyNoteColumnValidation.isValidName(name)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_NAME, 400));
        }

        if (color !== undefined && !StickyNoteColumnValidation.isValidColor(color)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_COLOR, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
