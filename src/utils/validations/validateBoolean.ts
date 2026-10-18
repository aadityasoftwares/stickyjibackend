import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

export const validateBoolean =
    (
        field: string,
        source: "body" | "query" | "params" = "body",
        required = true
    ) =>
        (
            req: Request,
            res: Response,
            next: NextFunction
        ) => {

            const value = req[source][field];

            if (
                value === undefined ||
                value === null
            ) {

                if (!required) {
                    return next();
                }

                return next();
            }

            const isBoolean =
                typeof value === "boolean" ||
                value === "true" ||
                value === "false";

            if (!isBoolean) {
                return next(
                    new AppError(
                        ValidationMessages.INVALID_BOOLEAN(field),
                        400
                    )
                );
            }

            next();

        };