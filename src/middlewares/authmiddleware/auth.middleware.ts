import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { JwtUtil } from "../../modules/auth/utils/jwt.util.js";
import { ResponseUtil } from "../../utils/response.util.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                sessionId: string;
            };
        }
    }
}

export const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {

        const authHeader = req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json(
                ResponseUtil.unauthorized(
                    "Unauthorized: No token provided"
                )
            );
        }

        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json(
                ResponseUtil.unauthorized(
                    "Unauthorized: No token provided"
                )
            );
        }

        let payload;

        try {
            payload = JwtUtil.verifyAccessToken(token);
        } catch (error) {
            return res.status(401).json(
                ResponseUtil.unauthorized(
                    "Unauthorized: Invalid or expired access token"
                )
            );
        }

        req.user = {
            id: payload.sub,
            sessionId: payload.sessionId,
        };

        return next();

    } catch (error: any) {
        console.error(
            "AuthMiddleware Error:",
            error
        );

        return res.status(500).json(
            ResponseUtil.serverError(
                error.message ||
                "Internal server error",
                error
            )
        );
    }
};