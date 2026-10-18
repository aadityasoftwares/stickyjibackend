import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";

import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { MediaType } from "../constants/media.enums.js";
import { MediaValidation } from "./media.validation.js";

export const requestUploadValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        const {
            fileName,
            mimeType,
            size,
            mediaType,
            purpose,
            visibility,
            resourceType,
            resourceId,
        } = req.body;

        if (typeof fileName !== "string") {
            return next(
                new AppError(
                    MediaMessages.FILE_NAME_REQUIRED,
                    400,
                ),
            );
        }

        const trimmedFileName = fileName.trim();

        if (
            !trimmedFileName ||
            trimmedFileName.length >
            MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH
        ) {
            return next(
                new AppError(
                    MediaMessages.INVALID_FILE_NAME,
                    400,
                ),
            );
        }

        if (typeof mimeType !== "string") {
            return next(
                new AppError(
                    MediaMessages.MIME_TYPE_REQUIRED,
                    400,
                ),
            );
        }

        const normalizedMimeType = mimeType
            .trim()
            .toLowerCase();

        if (
            !normalizedMimeType ||
            normalizedMimeType.length >
            MEDIA_CONSTANTS.MAX_MIME_TYPE_LENGTH
        ) {
            return next(
                new AppError(
                    MediaMessages.INVALID_MIME_TYPE,
                    400,
                ),
            );
        }

        if (!MediaValidation.isValidMediaType(mediaType)) {
            return next(
                new AppError(
                    MediaMessages.INVALID_MEDIA_TYPE,
                    400,
                ),
            );
        }

        if (size === undefined || size === null) {
            return next(
                new AppError(
                    MediaMessages.FILE_SIZE_REQUIRED,
                    400,
                ),
            );
        }

        if (
            typeof size !== "number" ||
            !Number.isInteger(size) ||
            size <= 0
        ) {
            return next(
                new AppError(
                    MediaMessages.INVALID_FILE_SIZE,
                    400,
                ),
            );
        }

        const maxSize =
            MEDIA_CONSTANTS.MAX_FILE_SIZE[
            mediaType as MediaType
            ];

        if (size > maxSize) {
            return next(
                new AppError(
                    MediaMessages.FILE_TOO_LARGE,
                    400,
                ),
            );
        }

        if (!MediaValidation.isValidPurpose(purpose)) {
            return next(
                new AppError(
                    MediaMessages.INVALID_PURPOSE,
                    400,
                ),
            );
        }

        if (
            visibility !== undefined &&
            !MediaValidation.isValidVisibility(visibility)
        ) {
            return next(
                new AppError(
                    MediaMessages.INVALID_VISIBILITY,
                    400,
                ),
            );
        }

        const allowedMimeTypes: any =
            MEDIA_CONSTANTS.ALLOWED_MIME_TYPES[
            mediaType as MediaType
            ];

        if (
            allowedMimeTypes.length > 0 &&
            !allowedMimeTypes.includes(normalizedMimeType)
        ) {
            return next(
                new AppError(
                    MediaMessages.MEDIA_TYPE_MISMATCH,
                    400,
                ),
            );
        }

        if (
            resourceType !== undefined &&
            resourceType !== null
        ) {
            if (
                !MediaValidation.isValidResourceType(
                    resourceType,
                )
            ) {
                return next(
                    new AppError(
                        MediaMessages.INVALID_RESOURCE_TYPE,
                        400,
                    ),
                );
            }
        }

        if (
            resourceId !== undefined &&
            resourceId !== null
        ) {
            if (
                !MediaValidation.isValidObjectId(
                    resourceId,
                )
            ) {
                return next(
                    new AppError(
                        MediaMessages.INVALID_RESOURCE_ID,
                        400,
                    ),
                );
            }
        }

        const hasResourceType =
            resourceType !== undefined &&
            resourceType !== null;

        const hasResourceId =
            resourceId !== undefined &&
            resourceId !== null;

        if (hasResourceType !== hasResourceId) {
            return next(
                new AppError(
                    MediaMessages.INVALID_RESOURCE,
                    400,
                ),
            );
        }

        return next();
    } catch (error) {
        return next(error);
    }
};