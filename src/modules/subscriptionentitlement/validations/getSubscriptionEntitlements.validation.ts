import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { getSubscriptionEntitlementsSchema } from "./subscriptionentitlement.schema.js";

const validate = validateUsingZOD(getSubscriptionEntitlementsSchema);

export const getSubscriptionEntitlementsValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = req.method === "GET" ? { ...req.query } : (req.body ?? {});
    return validate(req, res, next);
};
