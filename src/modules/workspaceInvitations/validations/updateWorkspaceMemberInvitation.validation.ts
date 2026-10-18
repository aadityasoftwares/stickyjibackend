import type { Request, Response, NextFunction } from "express";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { invitationUpdateSchema } from "./workspaceMemberInvitation.schema.js";
const validate = validateUsingZOD(invitationUpdateSchema);
export const updateWorkspaceMemberInvitationValidation = (req: Request, res: Response, next: NextFunction) => {
    validateId(req, res, (error) => (error ? next(error) : validate(req, res, next)));
};
