import type { Request, Response, NextFunction } from "express";
import { JwtUtil } from "../../modules/auth/utils/jwt.util.js";

export const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7).trim();
            if (token) {
                try {
                    const payload = JwtUtil.verifyAccessToken(token);
                    req.user = {
                        id: payload.sub,
                        sessionId: payload.sessionId,
                    };
                } catch {
                    // Ignore token errors for optional auth; proceed as guest
                }
            }
        }
        return next();
    } catch {
        return next();
    }
};
