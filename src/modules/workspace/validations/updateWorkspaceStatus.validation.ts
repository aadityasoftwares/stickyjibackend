import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { WorkspaceStatus, isWorkspaceTrashed } from "../constants/workspace.enums.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { WorkspaceValidation } from "./workspace.validation.js";

const ALLOWED_FIELDS = new Set(["status"]);

export const updateWorkspaceStatusValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            const body = req.body ?? {};
            const unsupportedFields = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));

            if (unsupportedFields.length || !WorkspaceValidation.isValidStatus(body.status)) {
                return next(new AppError(WorkspaceMessages.INVALID_STATUS, 400));
            }

            if (isWorkspaceTrashed(body.status)) {
                return next(new AppError(WorkspaceMessages.CANNOT_DELETE_THROUGH_STATUS, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
