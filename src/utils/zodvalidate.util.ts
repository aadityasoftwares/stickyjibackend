import type { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { ResponseUtil } from "./response.util.js";

export const validateUsingZOD =
    (schema: ZodType) =>
        (req: Request, res: Response, next: NextFunction) => {
            const result = schema.safeParse(req.body);

            if (!result.success) {
                // Map Zod issues to friendly messages
                const friendlyErrors = result.error.issues.map(issue => {
                    const field = issue.path.join(".");
                    return {
                        field,
                        message: issue.message
                    };
                });

                return res
                    .status(400)
                    .json(
                        ResponseUtil.validationError(
                            "Validation error",
                            friendlyErrors
                        )
                    );
            }

            req.body = result.data;
            next();
        };