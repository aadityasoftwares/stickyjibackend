import type {
    Request,
    Response,
    NextFunction,
} from "express";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    STICKY_NOTE_CHECKLIST_CONSTANTS,
} from "../constants/stickyNoteChecklist.constants.js";

import {
    StickyNoteChecklistMessages,
} from "../constants/stickyNoteChecklist.messages.js";

import {
    StickyNoteChecklistStatus,
} from "../constants/stickyNoteChecklist.enums.js";

import {
    StickyNoteChecklistValidation,
} from "./stickyNoteChecklist.validation.js";

export const getStickyNoteChecklistsValidation =
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
                        "Invalid sticky note checklist filters.",
                        400,
                    ),
                );
            }

            const {
                stickyNoteId,
                search,
                status,
                createdBy,
                page,
                limit,
                sortBy,
                sortOrder,
            } =
                source as Record<string, unknown>;

            if (
                typeof stickyNoteId !==
                "string" ||
                !StickyNoteChecklistValidation
                    .isValidObjectId(
                        stickyNoteId,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_STICKY_NOTE_ID,
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
                    STICKY_NOTE_CHECKLIST_CONSTANTS
                        .SEARCH.MAX_LENGTH
                ) {
                    return next(
                        new AppError(
                            StickyNoteChecklistMessages.INVALID_SEARCH,
                            400,
                        ),
                    );
                }
            }

            if (
                status !==
                undefined &&
                !StickyNoteChecklistValidation
                    .isValidStatus(
                        status,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_STATUS,
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
                    !StickyNoteChecklistValidation
                        .isValidObjectId(
                            createdBy,
                        )
                )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_CREATED_BY,
                        400,
                    ),
                );
            }

            if (
                page !==
                undefined &&
                !StickyNoteChecklistValidation
                    .isPositiveInteger(
                        page,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_PAGE,
                        400,
                    ),
                );
            }

            if (
                limit !==
                undefined &&
                !StickyNoteChecklistValidation
                    .isPositiveInteger(
                        limit,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_LIMIT,
                        400,
                    ),
                );
            }

            if (
                sortBy !==
                undefined &&
                !StickyNoteChecklistValidation
                    .isValidSortField(
                        sortBy,
                    )
            ) {
                return next(
                    new AppError(
                        StickyNoteChecklistMessages.INVALID_SORT,
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
                        StickyNoteChecklistMessages.INVALID_SORT_ORDER,
                        400,
                    ),
                );
            }

            if (
                status ===
                StickyNoteChecklistStatus.DELETED
            ) {
                // Explicit DELETED is allowed for trash/admin views.
            }

            next();
        } catch (error) {
            next(
                error,
            );
        }
    };
