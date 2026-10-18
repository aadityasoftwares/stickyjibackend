import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { StickyNoteMessages as M } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation as V } from "./stickyNote.validation.js";
export const reorderStickyNoteValidation = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const id = req.params.id;
  if (!V.isValidObjectId(id)) return next(new AppError(M.NOT_FOUND, 404));
  const { columnId, beforeId, afterId } = req.body ?? {};
  if (
    columnId !== undefined &&
    columnId !== null &&
    columnId !== "" &&
    !V.isValidObjectId(columnId)
  )
    return next(new AppError("Target columnId must be a valid ObjectId.", 400));
  if (beforeId !== undefined && beforeId !== null) {
    if (!V.isValidObjectId(beforeId))
      return next(
        new AppError("beforeId must be a valid ObjectId or null.", 400),
      );
    if (beforeId === id) return next(new AppError(M.CANNOT_REORDER_SELF, 400));
  }
  if (afterId !== undefined && afterId !== null) {
    if (!V.isValidObjectId(afterId))
      return next(
        new AppError("afterId must be a valid ObjectId or null.", 400),
      );
    if (afterId === id) return next(new AppError(M.CANNOT_REORDER_SELF, 400));
  }
  if (beforeId && afterId && beforeId === afterId)
    return next(new AppError(M.IDENTICAL_NEIGHBORS, 400));
  next();
};
