import type {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    validateId,
} from "../../../utils/validations/validateId.validation.js";

export const getStickyNoteAssigneeValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    return validateId(
        req,
        res,
        next,
    );
};
