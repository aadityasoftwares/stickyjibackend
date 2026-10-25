import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import { MediaPurpose, MediaType } from "../constants/media.enums.js";
import { MediaValidation } from "./media.validation.js";
import { MediaUtil } from "../utils/media.util.js";

export const requestUploadValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileName, mimeType, size, mediaType, purpose, visibility, resourceType, resourceId } =
            req.body;

        if (typeof fileName !== "string") {
            return next(new AppError(MediaMessages.FILE_NAME_REQUIRED, 400));
        }

        const sanitizedFileName = MediaUtil.sanitizeFileName(fileName);
        if (!sanitizedFileName || sanitizedFileName.length > MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH) {
            return next(new AppError(MediaMessages.INVALID_FILE_NAME, 400));
        }

        if (typeof mimeType !== "string") {
            return next(new AppError(MediaMessages.MIME_TYPE_REQUIRED, 400));
        }

        const normalizedMimeType = mimeType.trim().toLowerCase();

        if (!normalizedMimeType || normalizedMimeType.length > MEDIA_CONSTANTS.MAX_MIME_TYPE_LENGTH) {
            return next(new AppError(MediaMessages.INVALID_MIME_TYPE, 400));
        }

        if (!MediaValidation.isValidMediaType(mediaType)) {
            return next(new AppError(MediaMessages.INVALID_MEDIA_TYPE, 400));
        }

        if (!MediaValidation.isValidPurpose(purpose)) {
            return next(new AppError(MediaMessages.INVALID_PURPOSE, 400));
        }

        if (!MediaUtil.isMediaTypeAllowedForPurpose(purpose as MediaPurpose, mediaType as MediaType)) {
            return next(new AppError(MediaMessages.PURPOSE_MEDIA_TYPE_MISMATCH, 400));
        }

        if (size === undefined || size === null) {
            return next(new AppError(MediaMessages.FILE_SIZE_REQUIRED, 400));
        }

        const sizeValidation = MediaUtil.validateFileSize(size, mediaType as MediaType, purpose as MediaPurpose);
        if (!sizeValidation.valid) {
            return next(new AppError(sizeValidation.message ?? MediaMessages.INVALID_FILE_SIZE, 400));
        }

        const allowedMimeTypes: readonly string[] = MEDIA_CONSTANTS.ALLOWED_MIME_TYPES[mediaType as MediaType];
        if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(normalizedMimeType)) {
            return next(new AppError(MediaMessages.MEDIA_TYPE_MISMATCH, 400));
        }

        const ext = MediaUtil.extractExtension(sanitizedFileName);
        if (ext && !MediaUtil.isExtensionAllowedForMimeType(normalizedMimeType, ext)) {
            return next(new AppError(MediaMessages.INVALID_FILE_EXTENSION_FOR_MIME, 400));
        }

        if (visibility !== undefined && !MediaValidation.isValidVisibility(visibility)) {
            return next(new AppError(MediaMessages.INVALID_VISIBILITY, 400));
        }

        if (resourceId !== undefined && resourceId !== null) {
            if (!MediaValidation.isValidObjectId(resourceId)) {
                return next(new AppError(MediaMessages.INVALID_RESOURCE_ID, 400));
            }
            if (resourceType === undefined || resourceType === null) {
                return next(new AppError(MediaMessages.INVALID_RESOURCE_TYPE, 400));
            }
        }

        if (resourceType !== undefined && resourceType !== null) {
            if (!MediaValidation.isValidResourceType(resourceType)) {
                return next(new AppError(MediaMessages.INVALID_RESOURCE_TYPE, 400));
            }
        }

        const hasResourceType = resourceType !== undefined && resourceType !== null;
        const hasResourceId = resourceId !== undefined && resourceId !== null;

        if (hasResourceType !== hasResourceId) {
            return next(new AppError(MediaMessages.INVALID_RESOURCE, 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
