import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { updateFolderSchema } from "./workspaceFolder.schema.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
const validate = validateUsingZOD(updateFolderSchema);
export const updateWorkspaceFolderValidation = (req: Request, res: Response, next: NextFunction) =>
    validateId(req, res, error => error ? next(error) : validate(req, res, next));
