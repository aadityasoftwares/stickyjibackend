import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { workspaceDropdownSchema } from "./workspaceDropdown.schema.js";

const validate = validateUsingZOD(workspaceDropdownSchema);

export const getWorkspaceDropdownValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
        req.body = { ...req.query };
    } else {
        req.body ??= {};
    }
    return validate(req, res, next);
};
