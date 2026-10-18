import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

import { STICKY_NOTE_LABEL_CONSTANTS } from "../constants/stickyNoteLabel.constants.js";
import { StickyNoteLabelMessages } from "../constants/stickyNoteLabel.messages.js";

import { StickyNoteLabelValidation } from "./stickyNoteLabel.validation.js";

export const updateStickyNoteLabelValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            if (!req.body || Object.keys(req.body).length === 0) {
                return next(
                    new AppError(
                        StickyNoteLabelMessages.UPDATE_REQUIRED,
                        400,
                    ),
                );
            }

            const {
                workspaceId,
                name,
                slug,
                color,
                position,
                status,
                createdBy,
                updatedBy,
            } = req.body;

            if (workspaceId !== undefined) {
                return next(
                    new AppError(
                        StickyNoteLabelMessages.CANNOT_UPDATE_WORKSPACE,
                        400,
                    ),
                );
            }

            if (status !== undefined) {
                return next(
                    new AppError(
                        StickyNoteLabelMessages.CANNOT_UPDATE_STATUS,
                        400,
                    ),
                );
            }

            if (createdBy !== undefined) {
                return next(
                    new AppError(
                        StickyNoteLabelMessages.CANNOT_UPDATE_CREATED_BY,
                        400,
                    ),
                );
            }

            if (updatedBy !== undefined) {
                return next(
                    new AppError(
                        StickyNoteLabelMessages.CANNOT_UPDATE_UPDATED_BY,
                        400,
                    ),
                );
            }

            if (name !== undefined) {
                if (typeof name !== "string") {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_NAME,
                            400,
                        ),
                    );
                }

                const normalizedName =
                    StickyNoteLabelValidation.normalizeName(name);

                if (
                    !normalizedName ||
                    normalizedName.length <
                    STICKY_NOTE_LABEL_CONSTANTS.NAME.MIN_LENGTH ||
                    normalizedName.length >
                    STICKY_NOTE_LABEL_CONSTANTS.NAME.MAX_LENGTH
                ) {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_NAME,
                            400,
                        ),
                    );
                }
            }

            if (slug !== undefined) {
                if (typeof slug !== "string") {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_SLUG,
                            400,
                        ),
                    );
                }

                const normalizedSlug =
                    StickyNoteLabelValidation.normalizeSlug(slug);

                if (
                    !normalizedSlug ||
                    normalizedSlug.length <
                    STICKY_NOTE_LABEL_CONSTANTS.SLUG.MIN_LENGTH ||
                    normalizedSlug.length >
                    STICKY_NOTE_LABEL_CONSTANTS.SLUG.MAX_LENGTH ||
                    !StickyNoteLabelValidation.isValidSlug(
                        normalizedSlug,
                    )
                ) {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_SLUG,
                            400,
                        ),
                    );
                }
            }

            if (color !== undefined) {
                if (
                    !StickyNoteLabelValidation.isValidColor(color)
                ) {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_COLOR,
                            400,
                        ),
                    );
                }
            }

            if (position !== undefined) {
                if (
                    !StickyNoteLabelValidation.isValidPosition(
                        position,
                    ) ||
                    position < STICKY_NOTE_LABEL_CONSTANTS.POSITION.MIN
                ) {
                    return next(
                        new AppError(
                            StickyNoteLabelMessages.INVALID_POSITION,
                            400,
                        ),
                    );
                }
            }

            next();
        } catch (error) {
            next(error);
        }
    });
};