import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserProfileMessages } from "../constants/userProfile.messages.js";
import { USER_PROFILE_CONSTANTS } from "../constants/userProfile.constants.js";
import { MediaUtil } from "../../media/utils/media.util.js";

export const setProfileImageValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { mediaId } = req.body;

        if (!mediaId || typeof mediaId !== "string" || !/^[a-fA-F0-9]{24}$/.test(mediaId)) {
            return next(new AppError(UserProfileMessages.INVALID_PROFILE_IMAGE, 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};

export const requestProfileImageUploadValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { fileName, mimeType, size } = req.body;

        if (typeof fileName !== "string") {
            return next(new AppError("File name is required.", 400));
        }

        const sanitized = MediaUtil.sanitizeFileName(fileName);
        if (!sanitized) {
            return next(new AppError("Invalid file name.", 400));
        }

        if (typeof mimeType !== "string") {
            return next(new AppError("MIME type is required.", 400));
        }

        const normalizedMime = mimeType.trim().toLowerCase();
        const allowedMimes: readonly string[] = USER_PROFILE_CONSTANTS.PROFILE_IMAGE.ALLOWED_MIME_TYPES;

        if (!allowedMimes.includes(normalizedMime)) {
            return next(new AppError(UserProfileMessages.UNSUPPORTED_IMAGE_FORMAT, 400));
        }

        if (size === undefined || size === null) {
            return next(new AppError("File size is required.", 400));
        }

        if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
            return next(new AppError("Invalid file size.", 400));
        }

        if (size > USER_PROFILE_CONSTANTS.PROFILE_IMAGE.MAX_SIZE) {
            return next(new AppError(UserProfileMessages.PROFILE_IMAGE_TOO_LARGE, 400));
        }

        const ext = MediaUtil.extractExtension(sanitized);
        if (ext && !USER_PROFILE_CONSTANTS.PROFILE_IMAGE.ALLOWED_EXTENSIONS.includes(ext as any)) {
            return next(new AppError(UserProfileMessages.UNSUPPORTED_IMAGE_FORMAT, 400));
        }

        return next();
    } catch (error) {
        return next(error);
    }
};
