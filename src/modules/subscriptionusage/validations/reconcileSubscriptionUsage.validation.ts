import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { reconcileSubscriptionUsageSchema } from "./subscriptionusage.schema.js";

const validate = validateUsingZOD(reconcileSubscriptionUsageSchema);

export const reconcileSubscriptionUsageValidation = (req: Request, res: Response, next: NextFunction) => {
    return validate(req, res, next);
};
