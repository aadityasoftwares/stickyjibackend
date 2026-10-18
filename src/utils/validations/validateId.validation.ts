import type {
    Request,
    Response,
    NextFunction,
} from "express";
import { AppError } from "../errors/app.error.js";


export const validateId = (
    req: Request,
    res: Response,
    next: NextFunction
) => {

    const { id } = req.params;

    if (!id) {
        throw new AppError(
            "Resource id is required.",
            400
        );
    }

    next();
};