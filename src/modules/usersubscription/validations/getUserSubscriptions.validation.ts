import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { adminSubscriptionsSchema, userSubscriptionsSchema } from "./usersubscription.schema.js";

const validate = validateUsingZOD(userSubscriptionsSchema);
const validateAdmin = validateUsingZOD(adminSubscriptionsSchema);

export const getUserSubscriptionsValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = req.method === "GET" ? { ...req.query } : (req.body ?? {});
    return validate(req, res, next);
};

export const getAdminSubscriptionsValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = req.method === "GET" ? { ...req.query } : (req.body ?? {});
    return validateAdmin(req, res, next);
};
