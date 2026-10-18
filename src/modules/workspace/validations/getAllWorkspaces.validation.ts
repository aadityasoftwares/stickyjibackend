import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { workspaceListSchema } from "./workspaceList.schema.js";

const validate = validateUsingZOD(workspaceListSchema);

export const getAllWorkspacesValidation = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
        req.body = {
            ...req.query,
            ...(req.query.isPersonal === "true" || req.query.isPersonal === "false"
                ? { isPersonal: req.query.isPersonal === "true" }
                : {}),
        };
    } else {
        req.body ??= {};
    }
    return validate(req, res, next);
};
