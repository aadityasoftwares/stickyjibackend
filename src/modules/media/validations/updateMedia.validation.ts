import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { MediaValidation } from "./media.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

export const updateMediaValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return next(new AppError(MediaMessages.UPDATE_REQUIRED, 400));
        }

        const restrictedFields = [
            {
                field: "storageKey",
                message: MediaMessages.CANNOT_UPDATE_STORAGE_KEY,
            },
            {
                field: "uploadedBy",
                message: MediaMessages.CANNOT_UPDATE_OWNER,
            },
            {
                field: "storageProvider",
                message: MediaMessages.CANNOT_UPDATE_STORAGE_PROVIDER,
            },
            {
                field: "bucket",
                message: MediaMessages.CANNOT_UPDATE_BUCKET,
            },
            {
                field: "size",
                message: MediaMessages.CANNOT_UPDATE_SIZE,
            },
            {
                field: "mimeType",
                message: MediaMessages.CANNOT_UPDATE_MIME_TYPE,
            },
            {
                field: "mediaType",
                message: MediaMessages.CANNOT_UPDATE_MEDIA_TYPE,
            },
            {
                field: "status",
                message: MediaMessages.CANNOT_UPDATE_UPLOAD_STATUS,
            },
            {
                field: "uploadExpiresAt",
                message: MediaMessages.CANNOT_UPDATE_UPLOAD_STATUS,
            },
        ];

        for (const { field, message } of restrictedFields) {
            if (req.body[field] !== undefined) {
                return next(new AppError(message, 400));
            }
        }

        if (req.body.originalFileName !== undefined) {
            if (typeof req.body.originalFileName !== "string") {
                return next(new AppError(MediaMessages.INVALID_FILE_NAME, 400));
            }

            const fileName = req.body.originalFileName.trim();

            if (!fileName || fileName.length > MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH) {
                return next(new AppError(MediaMessages.INVALID_FILE_NAME, 400));
            }
        }

        if (req.body.extension !== undefined && req.body.extension !== null) {
            if (
                typeof req.body.extension !== "string" ||
                req.body.extension.trim().length > MEDIA_CONSTANTS.MAX_EXTENSION_LENGTH
            ) {
                return next(new AppError(MediaMessages.INVALID_EXTENSION, 400));
            }
        }

        if (req.body.purpose !== undefined && !MediaValidation.isValidPurpose(req.body.purpose)) {
            return next(new AppError(MediaMessages.INVALID_PURPOSE, 400));
        }

        if (req.body.visibility !== undefined && !MediaValidation.isValidVisibility(req.body.visibility)) {
            return next(new AppError(MediaMessages.INVALID_VISIBILITY, 400));
        }

        if (req.body.resourceType !== undefined && req.body.resourceType !== null) {
            if (!MediaValidation.isValidResourceType(req.body.resourceType)) {
                return next(new AppError(MediaMessages.INVALID_RESOURCE_TYPE, 400));
            }
        }

        if (req.body.resourceId !== undefined && req.body.resourceId !== null) {
            if (!MediaValidation.isValidObjectId(req.body.resourceId)) {
                return next(new AppError(MediaMessages.INVALID_RESOURCE_ID, 400));
            }
        }

        const resourceTypeProvided = Object.prototype.hasOwnProperty.call(req.body, "resourceType");

        const resourceIdProvided = Object.prototype.hasOwnProperty.call(req.body, "resourceId");

        if (resourceTypeProvided !== resourceIdProvided) {
            return next(new AppError(MediaMessages.INVALID_RESOURCE, 400));
        }

        return next();
    });
};
