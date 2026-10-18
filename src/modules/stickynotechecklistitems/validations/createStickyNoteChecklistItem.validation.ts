import type {
    Request,
    Response,
    NextFunction,
} from "express";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS,
} from "../constants/stickyNoteChecklistItem.constants.js";

import {
    StickyNoteChecklistItemMessages,
} from "../constants/stickyNoteChecklistItem.messages.js";

import {
    StickyNoteChecklistItemValidation,
} from "./stickyNoteChecklistItem.validation.js";

const ALLOWED_FIELDS =
    new Set([
        "checklistId",
        "title",
        "position",
    ]);

export const createStickyNoteChecklistItemValidation =
    (
        req: Request,
        _res: Response,
        next: NextFunction,
    ) => {
        try {
            const body =
                req.body ??
                {};

            const invalidFields =
                Object.keys(
                    body,
                )
                    .filter(
                        field =>
                            !ALLOWED_FIELDS.has(
                                field,
                            ),
                    );

            if (
                invalidFields.length >
                0
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_FIELD,
                        400,
                    ),
                );
            }

            const {
                checklistId,
                title,
                position,
            } =
                body;

            if (
                checklistId ===
                undefined ||
                checklistId ===
                null
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.CHECKLIST_ID_REQUIRED,
                        400,
                    ),
                );
            }

            if (
                !StickyNoteChecklistItemValidation
                    .isValidObjectId(
                        checklistId,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_CHECKLIST_ID,
                        400,
                    ),
                );
            }

            if (
                title ===
                undefined ||
                title ===
                null
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.TITLE_REQUIRED,
                        400,
                    ),
                );
            }

            if (
                typeof title !==
                "string"
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_TITLE,
                        400,
                    ),
                );
            }

            const normalizedTitle =
                StickyNoteChecklistItemValidation
                    .normalizeTitle(
                        title,
                    );

            if (
                normalizedTitle.length <
                STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS
                    .TITLE.MIN_LENGTH ||
                normalizedTitle.length >
                STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS
                    .TITLE.MAX_LENGTH
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_TITLE,
                        400,
                    ),
                );
            }

            if (
                position !==
                undefined &&
                !StickyNoteChecklistItemValidation
                    .isValidPosition(
                        position,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_POSITION,
                        400,
                    ),
                );
            }

            next();
        } catch (error) {
            next(
                error,
            );
        }
    };
