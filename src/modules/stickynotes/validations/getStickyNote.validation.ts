import type { NextFunction, Request, Response } from "express";
import { validateId } from "../../../utils/validations/validateId.validation.js";
export const getStickyNoteValidation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => validateId(req, res, next);
