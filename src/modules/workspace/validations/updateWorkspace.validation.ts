import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { WorkspaceValidation } from "./workspace.validation.js";

const ALLOWED_FIELDS = ["name", "slug", "description", "visibility"] as const;

export const updateWorkspaceValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
                return next(new AppError(WorkspaceMessages.UPDATE_REQUIRED, 400));
            }

            if (!WorkspaceValidation.hasOnlyAllowedFields(req.body, ALLOWED_FIELDS)) {
                return next(new AppError(WorkspaceMessages.UNSUPPORTED_FIELDS, 400));
            }

            const { name, slug, description, visibility } = req.body;

            if (name !== undefined) {
                if (typeof name !== "string") {
                    return next(new AppError(WorkspaceMessages.INVALID_NAME, 400));
                }

                const normalizedName = WorkspaceValidation.normalizeName(name);

                if (
                    normalizedName.length < WORKSPACE_CONSTANTS.NAME.MIN_LENGTH ||
                    normalizedName.length > WORKSPACE_CONSTANTS.NAME.MAX_LENGTH
                ) {
                    return next(new AppError(WorkspaceMessages.INVALID_NAME, 400));
                }
            }

            if (slug !== undefined) {
                if (typeof slug !== "string") {
                    return next(new AppError(WorkspaceMessages.INVALID_SLUG, 400));
                }

                const normalizedSlug = WorkspaceValidation.normalizeSlug(slug);

                if (
                    normalizedSlug.length < WORKSPACE_CONSTANTS.SLUG.MIN_LENGTH ||
                    normalizedSlug.length > WORKSPACE_CONSTANTS.SLUG.MAX_LENGTH ||
                    !WorkspaceValidation.isValidSlug(normalizedSlug)
                ) {
                    return next(new AppError(WorkspaceMessages.INVALID_SLUG, 400));
                }
            }

            if (
                description !== undefined &&
                description !== null &&
                (typeof description !== "string" ||
                    description.trim().length > WORKSPACE_CONSTANTS.DESCRIPTION.MAX_LENGTH)
            ) {
                return next(new AppError(WorkspaceMessages.INVALID_DESCRIPTION, 400));
            }

            if (visibility !== undefined && !WorkspaceValidation.isValidVisibility(visibility)) {
                return next(new AppError(WorkspaceMessages.INVALID_VISIBILITY, 400));
            }

            next();
        } catch (validationError) {
            next(validationError);
        }
    });
};
