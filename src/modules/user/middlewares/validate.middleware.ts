import type { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";
import { ResponseUtil } from "../../../utils/response.util.js";

export const validate =
    (schema: ZodType) =>
        (req: Request, res: Response, next: NextFunction) => {

            const result = schema.safeParse(req.body);

            if (!result.success) {
                return res
                    .status(400)
                    .json(
                        ResponseUtil.validationError(
                            "Validation error",
                            result.error.issues
                        )
                    );
            }

            req.body = result.data;

            next();
        };