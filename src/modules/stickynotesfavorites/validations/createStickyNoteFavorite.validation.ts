import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteFavoriteMessages } from "../constants/stickyNoteFavorite.messages.js";
import { StickyNoteFavoriteValidation } from "./stickyNoteFavorite.validation.js";

const ALLOWED_CREATE_FIELDS = new Set(["stickyNoteId", "noteId"]);

export const createStickyNoteFavoriteValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        if (!req.body || typeof req.body !== "object") {
            return next(new AppError("Request body is required.", 400));
        }

        const stickyNoteId = req.body.stickyNoteId ?? req.body.noteId;
        const { userId, status } = req.body;

        if (stickyNoteId === undefined || stickyNoteId === null || stickyNoteId === "") {
            return next(new AppError(StickyNoteFavoriteMessages.STICKY_NOTE_ID_REQUIRED, 400));
        }

        if (!StickyNoteFavoriteValidation.isValidObjectId(stickyNoteId)) {
            return next(new AppError(StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID, 400));
        }

        req.body.stickyNoteId = stickyNoteId;

        /**
         * User ID must be taken from the authenticated
         * user/session and must not be provided by the client.
         */
        if (userId !== undefined) {
            return next(new AppError(StickyNoteFavoriteMessages.CANNOT_UPDATE_USER, 400));
        }

        /**
         * Favorite status is managed internally.
         * New favorites are always created as ACTIVE.
         */
        if (status !== undefined) {
            return next(new AppError(StickyNoteFavoriteMessages.CANNOT_UPDATE_STATUS, 400));
        }

        const unknownField = Object.keys(req.body).find((field) => !ALLOWED_CREATE_FIELDS.has(field));
        if (unknownField) {
            return next(
                new AppError(
                    `Field "${unknownField}" is not allowed when creating a sticky note favorite.`,
                    400,
                ),
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};
