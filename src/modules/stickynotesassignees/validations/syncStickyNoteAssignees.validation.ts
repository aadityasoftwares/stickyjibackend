import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { STICKY_NOTE_ASSIGNEE_CONSTANTS } from "../constants/stickyNoteAssignee.constants.js";

import { StickyNoteAssigneeMessages } from "../constants/stickyNoteAssignee.messages.js";

import { StickyNoteAssigneeValidation } from "./stickyNoteAssignee.validation.js";

const ALLOWED_SYNC_FIELDS = new Set(["assigneeIds"]);

export const syncStickyNoteAssigneesValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const stickyNoteId = req.params.id;

        if (!StickyNoteAssigneeValidation.isValidObjectId(stickyNoteId)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_STICKY_NOTE_ID, 400));
        }

        if (!req.body || typeof req.body !== "object") {
            return next(new AppError(StickyNoteAssigneeMessages.REQUEST_BODY_REQUIRED, 400));
        }

        const unknownField = Object.keys(req.body).find((field) => !ALLOWED_SYNC_FIELDS.has(field));

        if (unknownField) {
            return next(
                new AppError(
                    `Field "${unknownField}" is not allowed when syncing sticky note assignees.`,
                    400,
                ),
            );
        }

        const { assigneeIds } = req.body;

        if (!Array.isArray(assigneeIds)) {
            return next(new AppError(StickyNoteAssigneeMessages.ASSIGNEE_IDS_REQUIRED, 400));
        }

        const uniqueIds = [...new Set(assigneeIds.map((value) => String(value).trim()))];

        if (uniqueIds.length > STICKY_NOTE_ASSIGNEE_CONSTANTS.MAX_PER_NOTE) {
            return next(new AppError(StickyNoteAssigneeMessages.TOO_MANY_ASSIGNEES, 400));
        }

        const hasInvalidId = uniqueIds.some((value) => !StickyNoteAssigneeValidation.isValidObjectId(value));

        if (hasInvalidId) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_ASSIGNEE_IDS, 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
