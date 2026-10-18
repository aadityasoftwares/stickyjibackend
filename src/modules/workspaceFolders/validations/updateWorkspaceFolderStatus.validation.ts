import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { folderStatusSchema } from "./workspaceFolder.schema.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
const validate = validateUsingZOD(folderStatusSchema);
export const updateWorkspaceFolderStatusValidation = (req: Request, res: Response, next: NextFunction) =>
    validateId(req, res, (error) => (error ? next(error) : validate(req, res, next)));
