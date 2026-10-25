import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { StickyNoteColumnValidation } from "./stickyNoteColumn.validation.js";
import { RankUtil } from "../../../utils/rank.util.js";

const ALLOWED_FIELDS = ["workspaceId", "workspaceFolderId", "name", "color", "position", "rank"] as const;

export const createStickyNoteColumnValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        if (!StickyNoteColumnValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
            return next(new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400));
        }

        if (
            typeof req.body.position === "string" &&
            req.body.position.trim() !== "" &&
            !Number.isNaN(Number(req.body.position))
        ) {
            req.body.position = Number(req.body.position);
        }

        if (typeof req.body.color === "string") {
            req.body.color = req.body.color.toUpperCase();
        }

        const { workspaceId, workspaceFolderId, name, color, position, rank } = req.body;

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

        if (position !== undefined && !StickyNoteColumnValidation.isValidPosition(position)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_POSITION, 400));
        }

        if (rank !== undefined && !RankUtil.isValidRank(rank)) {
            return next(new AppError(StickyNoteColumnMessages.INVALID_RANK, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
