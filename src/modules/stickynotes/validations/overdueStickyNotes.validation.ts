import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import { StickyNoteOverdueSort } from "../constants/stickyNote.enums.js";
import { StickyNoteMessages as M } from "../constants/stickyNote.messages.js";
import type { IStickyNoteOverdueFilter } from "../interfaces/stickynote.interface.js";
import { StickyNoteValidation as V } from "./stickyNote.validation.js";

export const getOverdueStickyNotesValidation = (
    req: Request,
    res: Response<unknown, { stickyNoteOverdueFilters: IStickyNoteOverdueFilter }>,
    next: NextFunction,
): void => {
    try {
        const allowed = new Set(["workspaceId", "workspaceFolderId", "page", "limit", "sort"]);
        const source: unknown =
            req.method === "POST"
                ? typeof req.body === "object" && req.body !== null && !Array.isArray(req.body)
                    ? { ...req.query, ...req.body }
                    : req.body
                : req.query;

        if (typeof source !== "object" || source === null || Array.isArray(source)) {
            throw new AppError(M.UNSUPPORTED_OVERDUE_FIELDS, 400);
        }
        const sourceObj = source as Record<string, unknown>;
        if (Object.keys(sourceObj).some((key) => !allowed.has(key))) {
            throw new AppError(M.UNSUPPORTED_OVERDUE_FIELDS, 400);
        }
        const { workspaceId, workspaceFolderId, page, limit, sort } = sourceObj;
        if (workspaceId !== undefined && !V.isValidObjectId(workspaceId))
            throw new AppError(M.INVALID_WORKSPACE_ID, 400);
        if (
            workspaceFolderId !== undefined &&
            workspaceFolderId !== "" &&
            !V.isValidObjectId(workspaceFolderId)
        )
            throw new AppError(M.INVALID_WORKSPACE_FOLDER_ID, 400);
        if (
            page !== undefined &&
            !V.isValidPositiveIntegerString(page) &&
            !(typeof page === "number" && Number.isSafeInteger(page) && page > 0)
        )
            throw new AppError(M.INVALID_PAGE, 400);
        if (
            limit !== undefined &&
            !V.isValidPositiveIntegerString(limit) &&
            !(typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0)
        )
            throw new AppError(M.INVALID_LIMIT, 400);
        if (
            sort !== undefined &&
            sort !== StickyNoteOverdueSort.OLDEST_FIRST &&
            sort !== StickyNoteOverdueSort.NEWEST_FIRST
        )
            throw new AppError(M.INVALID_OVERDUE_SORT, 400);
        const filters: IStickyNoteOverdueFilter = {
            page: page === undefined ? STICKY_NOTE_CONSTANTS.OVERDUE.DEFAULT_PAGE : Number(page),
            limit:
                limit === undefined
                    ? STICKY_NOTE_CONSTANTS.OVERDUE.DEFAULT_LIMIT
                    : Math.min(Number(limit), STICKY_NOTE_CONSTANTS.OVERDUE.MAX_LIMIT),
            sort: (sort as StickyNoteOverdueSort) ?? StickyNoteOverdueSort.OLDEST_FIRST,
        };
        if (!Number.isSafeInteger(((filters.page ?? 1) - 1) * (filters.limit ?? 20)))
            throw new AppError(M.INVALID_PAGE, 400);
        if (typeof workspaceId === "string" && V.isValidObjectId(workspaceId))
            filters.workspaceId = workspaceId;
        if (typeof workspaceFolderId === "string" && V.isValidObjectId(workspaceFolderId))
            filters.workspaceFolderId = workspaceFolderId;
        res.locals.stickyNoteOverdueFilters = filters;
        next();
    } catch (error) {
        next(error);
    }
};

export function validateBringStickyNoteIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) throw new AppError(M.INVALID_STICKY_NOTE_IDS, 400);
    if (value.length > STICKY_NOTE_CONSTANTS.OVERDUE.MAX_BATCH_SIZE)
        throw new AppError(M.TOO_MANY_STICKY_NOTE_IDS, 400);
    const ids: string[] = [];
    for (const id of value) {
        if (!V.isValidObjectId(id)) throw new AppError(M.INVALID_STICKY_NOTE_IDS, 400);
        ids.push(id.toLowerCase());
    }
    if (new Set(ids).size !== ids.length) throw new AppError(M.DUPLICATE_STICKY_NOTE_IDS, 400);
    return ids;
}

export const bringOverdueStickyNotesToTodayValidation = (
    req: Request,
    _res: Response,
    next: NextFunction,
): void => {
    try {
        const body: unknown = req.body;
        if (!body || typeof body !== "object" || Array.isArray(body) || !("stickyNoteIds" in body)) {
            throw new AppError(M.INVALID_STICKY_NOTE_IDS, 400);
        }
        if (Object.keys(body).some((key) => key !== "stickyNoteIds"))
            throw new AppError(M.UNSUPPORTED_OVERDUE_FIELDS, 400);
        req.body = {
            stickyNoteIds: validateBringStickyNoteIds(body.stickyNoteIds),
        };
        next();
    } catch (error) {
        next(error);
    }
};
