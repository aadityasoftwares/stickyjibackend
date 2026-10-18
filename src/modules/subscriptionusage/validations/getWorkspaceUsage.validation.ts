import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { getWorkspaceUsageSchema } from "./subscriptionusage.schema.js";

const validate = validateUsingZOD(getWorkspaceUsageSchema);

export const getWorkspaceUsageValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body = { ...req.params };
    return validate(req, res, next);
};
