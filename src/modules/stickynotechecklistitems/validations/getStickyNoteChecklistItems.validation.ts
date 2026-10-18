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

export const getStickyNoteChecklistItemsValidation =
    (
        req: Request,
        _res: Response,
        next: NextFunction,
    ) => {
        try {
            const source: unknown =
                (req.method === "POST" ? req.body : req.query) ?? {};

            if (typeof source !== "object" || source === null || Array.isArray(source)) {
                return next(
                    new AppError(
                        "Invalid sticky note checklist item filters.",
                        400,
                    ),
                );
            }

            const {
                checklistId,
                search,
                status,
                isCompleted,
                createdBy,
                completedBy,
                page,
                limit,
                sortBy,
                sortOrder,
            } =
                source as Record<string, unknown>;

            if (
                typeof checklistId !==
                "string" ||
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
                search !==
                undefined
            ) {
                if (
                    typeof search !==
                    "string" ||
                    search.trim().length >
                    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS
                        .SEARCH.MAX_LENGTH
                ) {
                    return next(
                        new AppError(
                            StickyNoteChecklistItemMessages.INVALID_SEARCH,
                            400,
                        ),
                    );
                }
            }

            if (
                status !==
                undefined &&
                !StickyNoteChecklistItemValidation
                    .isValidStatus(
                        status,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_STATUS,
                        400,
                    ),
                );
            }

            if (
                isCompleted !==
                undefined &&
                isCompleted !==
                true &&
                isCompleted !==
                false &&
                isCompleted !==
                "true" &&
                isCompleted !==
                "false"
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_COMPLETION_STATUS,
                        400,
                    ),
                );
            }

            if (
                createdBy !==
                undefined &&
                (
                    typeof createdBy !==
                    "string" ||
                    !StickyNoteChecklistItemValidation
                        .isValidObjectId(
                            createdBy,
                        )
                )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_CREATED_BY,
                        400,
                    ),
                );
            }

            if (
                completedBy !==
                undefined &&
                (
                    typeof completedBy !==
                    "string" ||
                    !StickyNoteChecklistItemValidation
                        .isValidObjectId(
                            completedBy,
                        )
                )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_COMPLETED_BY,
                        400,
                    ),
                );
            }

            if (
                page !==
                undefined &&
                !StickyNoteChecklistItemValidation
                    .isPositiveInteger(
                        page,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_PAGE,
                        400,
                    ),
                );
            }

            if (
                limit !==
                undefined &&
                !StickyNoteChecklistItemValidation
                    .isPositiveInteger(
                        limit,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_LIMIT,
                        400,
                    ),
                );
            }

            if (
                sortBy !==
                undefined &&
                !StickyNoteChecklistItemValidation
                    .isValidSortField(
                        sortBy,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_SORT,
                        400,
                    ),
                );
            }

            if (
                sortOrder !==
                undefined &&
                sortOrder !==
                "asc" &&
                sortOrder !==
                "desc"
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistItemMessages.INVALID_SORT_ORDER,
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
