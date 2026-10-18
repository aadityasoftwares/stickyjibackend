import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateBodySize =
    (maxSizeInBytes: number) =>
        (
            req: Request,
            res: Response,
            next: NextFunction
        ) => {

            const contentLength = req.headers["content-length"];

            if (!contentLength) {
                return next();
            }

            const size = Number(contentLength);

            if (
                Number.isNaN(size) ||
                size <= 0
            ) {
                return next();
            }

            if (size > maxSizeInBytes) {

                const maxSize =
                    maxSizeInBytes >= 1024 * 1024
                        ? `${(maxSizeInBytes / (1024 * 1024)).toFixed(2)} MB`
                        : `${(maxSizeInBytes / 1024).toFixed(2)} KB`;

                return next(
                    new AppError(
                        ValidationMessages.PAYLOAD_TOO_LARGE(maxSize),
                        413
                    )
                );
            }

            next();

        };