import type {
    Request,
    Response,
    NextFunction,
} from "express";
import { AppError } from "../../utils/errors/app.error.js";
import { ResponseUtil } from "../../utils/response.util.js";

export const errorMiddleware = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {

    if (error instanceof AppError) {

        return res.status(error.statusCode).json(
            ResponseUtil.error(error.message, error.code),
        );

    }

    console.error(error);

    return res.status(500).json(
        ResponseUtil.error("Internal server error.", "INTERNAL_SERVER_ERROR"),
    );

};
