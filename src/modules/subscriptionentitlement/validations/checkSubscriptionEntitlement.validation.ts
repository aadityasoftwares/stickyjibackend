import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { checkSubscriptionEntitlementSchema } from "./subscriptionentitlement.schema.js";

const validate = validateUsingZOD(checkSubscriptionEntitlementSchema);

export const checkSubscriptionEntitlementValidation = (req: Request, res: Response, next: NextFunction) => {
    return validate(req, res, next);
};
