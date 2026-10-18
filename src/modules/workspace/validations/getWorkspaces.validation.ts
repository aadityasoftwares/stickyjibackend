import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { WorkspaceValidation } from "./workspace.validation.js";

const ALLOWED_QUERY_FIELDS = new Set([
    "page",
    "limit",
    "search",
    "status",
    "visibility",
    "isPersonal",
    "sortBy",
    "sortOrder",
]);

export const getWorkspacesValidation = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const unsupportedFields = Object.keys(req.query).filter((field) => !ALLOWED_QUERY_FIELDS.has(field));

        if (unsupportedFields.length) {
            return next(new AppError(WorkspaceMessages.UNSUPPORTED_FIELDS, 400));
        }

        const { page, limit, search, status, visibility, isPersonal, sortBy, sortOrder } = req.query;

        if (page !== undefined && !WorkspaceValidation.isPositiveInteger(page)) {
            return next(new AppError(WorkspaceMessages.INVALID_PAGE, 400));
        }

        if (limit !== undefined && !WorkspaceValidation.isPositiveInteger(limit)) {
            return next(new AppError(WorkspaceMessages.INVALID_LIMIT, 400));
        }

        if (
            search !== undefined &&
            (typeof search !== "string" || search.trim().length > WORKSPACE_CONSTANTS.SEARCH.MAX_LENGTH)
        ) {
            return next(new AppError(WorkspaceMessages.INVALID_SEARCH, 400));
        }

        if (status !== undefined && !WorkspaceValidation.isValidStatus(status)) {
            return next(new AppError(WorkspaceMessages.INVALID_STATUS, 400));
        }

        if (visibility !== undefined && !WorkspaceValidation.isValidVisibility(visibility)) {
            return next(new AppError(WorkspaceMessages.INVALID_VISIBILITY, 400));
        }

        if (isPersonal !== undefined && isPersonal !== "true" && isPersonal !== "false") {
            return next(new AppError(WorkspaceMessages.INVALID_PERSONAL_WORKSPACE, 400));
        }

        if (sortBy !== undefined && !WorkspaceValidation.isValidSortField(sortBy)) {
            return next(new AppError(WorkspaceMessages.INVALID_SORT, 400));
        }

        if (sortOrder !== undefined && sortOrder !== "asc" && sortOrder !== "desc") {
            return next(new AppError(WorkspaceMessages.INVALID_SORT_ORDER, 400));
        }

        next();
    } catch (error) {
        next(error);
    }
};
