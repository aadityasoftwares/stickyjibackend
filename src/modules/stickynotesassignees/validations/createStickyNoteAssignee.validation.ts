import type {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    StickyNoteAssigneeMessages,
} from "../constants/stickyNoteAssignee.messages.js";

import {
    StickyNoteAssigneeValidation,
} from "./stickyNoteAssignee.validation.js";

const ALLOWED_CREATE_FIELDS =
    new Set([
        "stickyNoteId",
        "userId",
    ]);

export const createStickyNoteAssigneeValidation = (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        if (
            !req.body ||
            typeof req.body !== "object"
        ) {
            return next(
                new AppError(
                    StickyNoteAssigneeMessages.REQUEST_BODY_REQUIRED,
                    400,
                ),
            );
        }

        const unknownField =
            Object.keys(req.body).find(
                field =>
                    !ALLOWED_CREATE_FIELDS.has(
                        field,
                    ),
            );

        if (unknownField) {
            return next(
                new AppError(
                    `Field "${unknownField}" is not allowed when assigning a sticky note.`,
                    400,
                ),
            );
        }

        const {
            stickyNoteId,
            userId,
        } = req.body;

        if (
            stickyNoteId === undefined ||
            stickyNoteId === null ||
            stickyNoteId === ""
        ) {
            return next(
                new AppError(
                    StickyNoteAssigneeMessages.STICKY_NOTE_ID_REQUIRED,
                    400,
                ),
            );
        }

        if (
            !StickyNoteAssigneeValidation
                .isValidObjectId(
                    stickyNoteId,
                )
        ) {
            return next(
                new AppError(
                    StickyNoteAssigneeMessages.INVALID_STICKY_NOTE_ID,
                    400,
                ),
            );
        }

        if (
            userId === undefined ||
            userId === null ||
            userId === ""
        ) {
            return next(
                new AppError(
                    StickyNoteAssigneeMessages.USER_ID_REQUIRED,
                    400,
                ),
            );
        }

        if (
            !StickyNoteAssigneeValidation
                .isValidObjectId(
                    userId,
                )
        ) {
            return next(
                new AppError(
                    StickyNoteAssigneeMessages.INVALID_USER_ID,
                    400,
                ),
            );
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
