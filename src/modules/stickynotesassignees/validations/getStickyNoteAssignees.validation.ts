import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { StickyNoteAssigneeMessages } from "../constants/stickyNoteAssignee.messages.js";

import { StickyNoteAssigneeValidation } from "./stickyNoteAssignee.validation.js";

const ALLOWED_QUERY_FIELDS = new Set([
    "workspaceId",
    "stickyNoteId",
    "userId",
    "status",
    "page",
    "limit",
    "sortBy",
    "sortOrder",
]);

export const getStickyNoteAssigneesValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const unknownField = Object.keys(req.query).find((field) => !ALLOWED_QUERY_FIELDS.has(field));

        if (unknownField) {
            return next(new AppError(`Query field "${unknownField}" is not supported.`, 400));
        }

        const { workspaceId, stickyNoteId, userId, status, page, limit, sortBy, sortOrder } = req.query;

        if (workspaceId === undefined && stickyNoteId === undefined) {
            return next(new AppError(StickyNoteAssigneeMessages.SCOPE_REQUIRED, 400));
        }

        if (workspaceId !== undefined && !StickyNoteAssigneeValidation.isValidObjectId(workspaceId)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_WORKSPACE_ID, 400));
        }

        if (stickyNoteId !== undefined && !StickyNoteAssigneeValidation.isValidObjectId(stickyNoteId)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_STICKY_NOTE_ID, 400));
        }

        if (userId !== undefined && !StickyNoteAssigneeValidation.isValidObjectId(userId)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_USER_ID, 400));
        }

        if (status !== undefined && !StickyNoteAssigneeValidation.isValidStatus(status)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_STATUS, 400));
        }

        if (page !== undefined && !StickyNoteAssigneeValidation.isValidPositiveIntegerString(page)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_PAGE, 400));
        }

        if (limit !== undefined && !StickyNoteAssigneeValidation.isValidPositiveIntegerString(limit)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_LIMIT, 400));
        }

        if (sortBy !== undefined && !StickyNoteAssigneeValidation.isValidSortField(sortBy)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_SORT_FIELD, 400));
        }

        if (sortOrder !== undefined && !StickyNoteAssigneeValidation.isValidSortOrder(sortOrder)) {
            return next(new AppError(StickyNoteAssigneeMessages.INVALID_SORT_ORDER, 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
