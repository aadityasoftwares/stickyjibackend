import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { invitationListSchema } from "./workspaceMemberInvitation.schema.js";

const validate = validateUsingZOD(invitationListSchema);

export const getAllWorkspaceMemberInvitationsValidation = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    if (req.method === "GET") {
        req.body = {
            ...req.query,
        };
    } else {
        req.body ??= {};
    }
    return validate(req, res, next);
};
