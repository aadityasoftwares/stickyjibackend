import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { STICKY_NOTE_COLUMN_CONSTANTS } from "../constants/stickyNoteColumn.constants.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";

const ALLOWED_FIELDS = ["workspaceId", "workspaceFolderId", "columnIds"] as const;

export const reorderStickyNoteColumnsValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(StickyNoteColumnMessages.COLUMN_IDS_REQUIRED, 400));
        }

        if (!StickyNoteColumnValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        const { workspaceId, workspaceFolderId, columnIds } = req.body;

        if (!StickyNoteColumnValidation.isValidObjectId(workspaceId)) {
            return next(new AppError(
                workspaceId === undefined
                    ? StickyNoteColumnMessages.WORKSPACE_ID_REQUIRED
                    : StickyNoteColumnMessages.INVALID_WORKSPACE_ID,
                400,
            ));
        }

        if (!StickyNoteColumnValidation.isValidObjectId(workspaceFolderId)) {
            return next(new AppError(
                workspaceFolderId === undefined
                    ? StickyNoteColumnMessages.WORKSPACE_FOLDER_ID_REQUIRED
                    : StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID,
                400,
            ));
        }

        if (!Array.isArray(columnIds) || columnIds.length === 0) {
            return next(new AppError(StickyNoteColumnMessages.COLUMN_IDS_REQUIRED, 400));
        }

        if (columnIds.length > STICKY_NOTE_COLUMN_CONSTANTS.MAX_COLUMNS_PER_FOLDER) {
            return next(new AppError(StickyNoteColumnMessages.MAX_COLUMNS_REACHED, 400));
        }

        if (!columnIds.every((id: unknown) => StickyNoteColumnValidation.isValidObjectId(id))) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_COLUMN_IDS, 400));
        }

        if (StickyNoteColumnValidation.hasDuplicateIds(columnIds)) {
            return next(new AppError(StickyNoteColumnMessages.DUPLICATE_COLUMN_IDS, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
