import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateContentType =
    (
        ...allowedTypes: string[]
    ) =>
        (
            req: Request,
            res: Response,
            next: NextFunction
        ) => {

            if (
                ["GET", "DELETE", "HEAD"].includes(req.method)
            ) {
                return next();
            }

            const contentType =
                req.headers["content-type"];

            if (!contentType) {
                return next(
                    new AppError(
                        ValidationMessages.CONTENT_TYPE_REQUIRED,
                        400
                    )
                );
            }

            const isAllowed =
                allowedTypes.some(type =>
                    contentType
                        .toLowerCase()
                        .startsWith(type.toLowerCase())
                );

            if (!isAllowed) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_CONTENT_TYPE(
                            allowedTypes.join(" or ")
                        ),
                        415
                    )
                );
            }

            next();

        };