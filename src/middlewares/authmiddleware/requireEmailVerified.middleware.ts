import type { Request, Response, NextFunction } from "express";
import { UserModel } from "../../modules/user/models/user.model.js";
import { ResponseUtil } from "../../utils/response.util.js";
import { AuthMessages } from "../../modules/auth/constants/auth.messages.js";

/**
 * Middleware that restricts email-dependent operations until the user's email has been verified.
 */
export const requireEmailVerified = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json(ResponseUtil.unauthorized("Unauthorized"));
        }

        const user = await UserModel.findById(userId).select("isEmailVerified").lean();
        if (!user) {
            return res.status(404).json(ResponseUtil.notFound("User not found"));
        }

        if (!user.isEmailVerified) {
            return res.status(403).json(ResponseUtil.forbidden(AuthMessages.EMAIL_NOT_VERIFIED));
        }

        return next();
    } catch (error) {
        next(error);
    }
};
