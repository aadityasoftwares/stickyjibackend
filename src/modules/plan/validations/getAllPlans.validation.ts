import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { planListSchema } from "./planList.schema.js";

const validate = validateUsingZOD(planListSchema);

export const getAllPlansValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
        req.body = {
            ...req.query,
            ...(req.query.isPopular === "true" || req.query.isPopular === "false"
                ? { isPopular: req.query.isPopular === "true" }
                : {}),
            ...(req.query.isDefault === "true" || req.query.isDefault === "false"
                ? { isDefault: req.query.isDefault === "true" }
                : {}),
            ...(req.query.isSystem === "true" || req.query.isSystem === "false"
                ? { isSystem: req.query.isSystem === "true" }
                : {}),
            ...(req.query.isActive === "true" || req.query.isActive === "false"
                ? { isActive: req.query.isActive === "true" }
                : {}),
        };
    } else {
        req.body ??= {};
    }
    return validate(req, res, next);
};
