import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { subscriptionUsageListSchema } from "./subscriptionusage.schema.js";

const validate = validateUsingZOD(subscriptionUsageListSchema);

export const getSubscriptionUsageListValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = req.method === "GET" ? { ...req.query } : req.body ?? {};
    return validate(req, res, next);
};
