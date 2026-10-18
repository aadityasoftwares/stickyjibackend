import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { cancelSubscriptionSchema, emptySubscriptionSchema } from "./usersubscription.schema.js";

const validateCancel = validateUsingZOD(cancelSubscriptionSchema);
const validateUndo = validateUsingZOD(emptySubscriptionSchema);

export const cancelSubscriptionValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body ??= {};
    return validateCancel(req, res, next);
};
export const undoSubscriptionCancellationValidation = (req: Request, res: Response, next: NextFunction) => {
    req.body ??= {};
    return validateUndo(req, res, next);
};
