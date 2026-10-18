import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteMessages as M } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation as V } from "./stickyNote.validation.js";
import type { IStickyNoteFilter } from "../interfaces/stickyNote.interface.js";
export const getStickyNotesValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const source: unknown =
      (req.method === "POST" ? req.body : req.query) ?? {};
    if (typeof source !== "object" || source === null || Array.isArray(source))
      throw new AppError("Invalid sticky note filters.", 400);
    const {
      workspaceId,
      workspaceFolderId,
      columnId,
      search,
      color,
      priority,
      shape,
      variant,
      status,
      createdBy,
      noteDate,
      datePreset,
      page,
      limit,
      sortBy,
      sortOrder,
    } = source as Record<string, unknown>;
    if (workspaceId !== undefined && !V.isValidObjectId(workspaceId))
      throw new AppError(M.INVALID_WORKSPACE_ID, 400);
    if (
      workspaceFolderId !== undefined &&
      workspaceFolderId !== "" &&
      !V.isValidObjectId(workspaceFolderId)
    )
      throw new AppError(M.INVALID_WORKSPACE_FOLDER_ID, 400);
    if (columnId !== undefined && !V.isValidObjectId(columnId))
      throw new AppError(M.INVALID_COLUMN_ID, 400);
    if (createdBy !== undefined && !V.isValidObjectId(createdBy))
      throw new AppError("Invalid createdBy id.", 400);
    if (
      search !== undefined &&
      (typeof search !== "string" || search.trim().length > 200)
    )
      throw new AppError("Invalid search value.", 400);
    if (color !== undefined && !V.isValidColor(color))
      throw new AppError(M.INVALID_COLOR, 400);
    if (priority !== undefined && !V.isValidPriority(priority))
      throw new AppError(M.INVALID_PRIORITY, 400);
    if (shape !== undefined && !V.isValidShape(shape))
      throw new AppError(M.INVALID_SHAPE, 400);
    if (variant !== undefined && !V.isValidVariant(variant))
      throw new AppError(M.INVALID_VARIANT, 400);
    if (status !== undefined && !V.isValidStatus(status))
      throw new AppError(M.INVALID_STATUS, 400);
    if (noteDate !== undefined && !V.isValidDateKey(noteDate))
      throw new AppError(M.INVALID_NOTE_DATE, 400);
    if (datePreset !== undefined && !V.isValidDatePreset(datePreset))
      throw new AppError(M.INVALID_DATE_PRESET, 400);
    if (noteDate !== undefined && datePreset !== undefined)
      throw new AppError(M.DATE_FILTER_CONFLICT, 400);
    if (
      page !== undefined &&
      !V.isValidPositiveIntegerString(page) &&
      !(typeof page === "number" && Number.isSafeInteger(page) && page > 0)
    )
      throw new AppError("Page must be a positive integer.", 400);
    if (
      limit !== undefined &&
      !V.isValidPositiveIntegerString(limit) &&
      !(typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0)
    )
      throw new AppError("Limit must be a positive integer.", 400);
    if (sortBy !== undefined && !V.isValidSortField(sortBy))
      throw new AppError("Invalid sort field.", 400);
    if (sortOrder !== undefined && !V.isValidSortOrder(sortOrder))
      throw new AppError('sortOrder must be "asc" or "desc".', 400);
    const filters: IStickyNoteFilter = {
      page: page === undefined ? 1 : Number(page),
      limit: limit === undefined ? 20 : Math.min(Number(limit), 100),
    };
    if (typeof workspaceId === "string")
      filters.workspaceId = workspaceId.trim();
    if (typeof workspaceFolderId === "string" && workspaceFolderId.trim())
      filters.workspaceFolderId = workspaceFolderId.trim();
    if (typeof columnId === "string") filters.columnId = columnId.trim();
    if (typeof search === "string" && search.trim())
      filters.search = V.normalizeSearch(search);
    if (V.isValidColor(color)) filters.color = color;
    if (V.isValidPriority(priority)) filters.priority = priority;
    if (V.isValidShape(shape)) filters.shape = shape;
    if (V.isValidVariant(variant)) filters.variant = variant;
    if (V.isValidStatus(status)) filters.status = status;
    if (typeof createdBy === "string") filters.createdBy = createdBy.trim();
    if (typeof noteDate === "string") filters.noteDate = noteDate;
    if (V.isValidDatePreset(datePreset)) filters.datePreset = datePreset;
    if (V.isValidSortField(sortBy)) filters.sortBy = sortBy;
    if (V.isValidSortOrder(sortOrder)) filters.sortOrder = sortOrder;
    res.locals.stickyNoteFilters = filters;
    next();
  } catch (error) {
    next(error);
  }
};
