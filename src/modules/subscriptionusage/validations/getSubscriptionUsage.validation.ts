import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { getSubscriptionUsageSchema } from "./subscriptionusage.schema.js";

const validate = validateUsingZOD(getSubscriptionUsageSchema);

export const getSubscriptionUsageValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = req.method === "GET" ? { ...req.query } : (req.body ?? {});
    return validate(req, res, next);
};
