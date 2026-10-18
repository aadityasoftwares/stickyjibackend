import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { AppError } from "../errors/app.error.js";
import { ValidationMessages } from "../constants/validation.messages.js";

const PHONE_REGEX =
    /^\+?[1-9]\d{1,14}$/;

export const validatePhoneValue = (
    value: unknown,
    field: string = "phone",
    required: boolean = true
): string | undefined => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        if (required) {
            throw new AppError(
                ValidationMessages.FIELD_REQUIRED(field),
                400
            );
        }

        return undefined;
    }

    if (typeof value !== "string") {
        throw new AppError(
            ValidationMessages.INVALID_PHONE,
            400
        );
    }

    const phone = value.trim();

    if (!phone) {
        if (required) {
            throw new AppError(
                ValidationMessages.FIELD_REQUIRED(field),
                400
            );
        }

        return undefined;
    }

    if (!PHONE_REGEX.test(phone)) {
        throw new AppError(
            ValidationMessages.INVALID_PHONE,
            400
        );
    }

    return phone;
};

export const validatePhone =
    (
        field: string = "phone",
        location: "body" | "query" | "params" = "body",
        required: boolean = true
    ) =>
        (
            req: Request,
            res: Response,
            next: NextFunction
        ) => {
            try {
                const value =
                    req[location]?.[field];

                const phone =
                    validatePhoneValue(
                        value,
                        field,
                        required
                    );

                if (phone !== undefined) {
                    req[location][field] =
                        phone;
                }

                next();
            } catch (error) {
                next(error);
            }
        };