import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";

import {
    StickyNoteFavoriteMessages,
} from "../constants/stickyNoteFavorite.messages.js";

import {
    StickyNoteFavoriteValidation,
} from "./stickyNoteFavorite.validation.js";

export const updateStickyNoteFavoriteStatusValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    validateId(req, res, (error?: unknown) => {
        if (error) {
            return next(error);
        }

        try {
            if (
                !req.body ||
                Object.keys(req.body).length === 0
            ) {
                return next(
                    new AppError(
                        StickyNoteFavoriteMessages.INVALID_STATUS,
                        400,
                    ),
                );
            }

            const {
                status,
                stickyNoteId,
                userId,
            } = req.body;

            if (
                !StickyNoteFavoriteValidation.isValidStatus(
                    status,
                )
            ) {
                return next(
                    new AppError(
                        StickyNoteFavoriteMessages.INVALID_STATUS,
                        400,
                    ),
                );
            }

            /**
             * Only status can be updated through this endpoint.
             */
            const allowedFields = ["status"];

            const invalidFields = Object.keys(
                req.body,
            ).filter(
                (field) =>
                    !allowedFields.includes(field),
            );

            if (invalidFields.length > 0) {
                return next(
                    new AppError(
                        StickyNoteFavoriteMessages.INVALID_STATUS,
                        400,
                    ),
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    });
};