import type { Request, Response, NextFunction } from "express";
import { RequestUtil } from "../../../utils/request.util.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { UserSubscriptionMessages } from "../constants/usersubscription.messages.js";
import { subscriptionObjectIdSchema } from "./usersubscription.schema.js";

export const getUserSubscriptionValidation = (req: Request, _res: Response, next: NextFunction) => {
    if (!subscriptionObjectIdSchema.safeParse(RequestUtil.getParam(req.params.id)).success) {
        return next(new AppError(UserSubscriptionMessages.INVALID_ID, 400));
    }
    next();
};
