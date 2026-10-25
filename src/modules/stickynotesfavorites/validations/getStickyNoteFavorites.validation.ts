import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteFavoriteMessages } from "../constants/stickyNoteFavorite.messages.js";
import { StickyNoteFavoriteValidation } from "./stickyNoteFavorite.validation.js";

export const getStickyNoteFavoritesValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const source = (req.method === "POST" ? req.body : req.query) ?? {};
        const { stickyNoteId, workspaceId, workspaceFolderId, search, status, page, limit, sortBy, sortOrder } = source;

        if (
            stickyNoteId !== undefined &&
            stickyNoteId !== "" &&
            !StickyNoteFavoriteValidation.isValidObjectId(stickyNoteId)
        ) {
            return next(new AppError(StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID, 400));
        }

        if (
            workspaceId !== undefined &&
            workspaceId !== "" &&
            !StickyNoteFavoriteValidation.isValidObjectId(workspaceId)
        ) {
            return next(new AppError("Invalid workspace ID.", 400));
        }

        if (
            workspaceFolderId !== undefined &&
            workspaceFolderId !== "" &&
            !StickyNoteFavoriteValidation.isValidObjectId(workspaceFolderId)
        ) {
            return next(new AppError("Invalid workspace folder ID.", 400));
        }

        if (status !== undefined && !StickyNoteFavoriteValidation.isValidStatus(status)) {
            return next(new AppError(StickyNoteFavoriteMessages.INVALID_STATUS, 400));
        }

        if (
            page !== undefined &&
            !StickyNoteFavoriteValidation.isValidPositiveIntegerString(page) &&
            !(typeof page === "number" && Number.isInteger(page) && page > 0)
        ) {
            return next(new AppError("Page must be a positive integer.", 400));
        }

        if (
            limit !== undefined &&
            !StickyNoteFavoriteValidation.isValidPositiveIntegerString(limit) &&
            !(typeof limit === "number" && Number.isInteger(limit) && limit > 0)
        ) {
            return next(new AppError("Limit must be a positive integer.", 400));
        }

        if (sortBy !== undefined && !StickyNoteFavoriteValidation.isValidSortField(sortBy)) {
            return next(new AppError("Invalid sort field.", 400));
        }

        if (sortOrder !== undefined && !StickyNoteFavoriteValidation.isValidSortOrder(sortOrder)) {
            return next(new AppError('sortOrder must be "asc" or "desc".', 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
