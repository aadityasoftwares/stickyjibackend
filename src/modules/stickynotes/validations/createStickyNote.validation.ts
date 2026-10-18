import type { NextFunction, Request, Response } from "express";
import { validateStickyNoteFields } from "./stickyNoteFields.validation.js";
export const createStickyNoteValidation = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    validateStickyNoteFields(req.body, "create");
    next();
  } catch (error) {
    next(error);
  }
};
