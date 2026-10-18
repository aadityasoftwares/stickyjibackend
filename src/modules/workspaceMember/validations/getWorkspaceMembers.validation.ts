import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { workspaceMemberListSchema } from "./workspaceMember.schema.js";

export const getWorkspaceMembersValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        let source: Record<string, unknown>;

        if (req.method === "POST") {
            if (typeof req.body !== "object" || req.body === null || Array.isArray(req.body)) {
                return next(new AppError(WorkspaceMemberMessages.UNSUPPORTED_CREATE_FIELDS, 400));
            }
            source = { ...req.body };
        } else {
            const query = { ...req.query };
            for (const [key, value] of Object.entries(query)) {
                if (value === "" || value === undefined) {
                    delete query[key];
                }
            }
            source = query;
        }

        if (!source.workspaceId) {
            return next(new AppError(WorkspaceMemberMessages.WORKSPACE_ID_REQUIRED, 400));
        }

        const result = workspaceMemberListSchema.safeParse(source);
        if (!result.success) {
            return next(
                new AppError(
                    result.error.issues[0]?.message ?? WorkspaceMemberMessages.INVALID_WORKSPACE_ID,
                    400,
                ),
            );
        }

        req.body = result.data;
        res.locals.memberFilters = result.data;
        next();
    } catch (error) {
        next(error);
    }
};

export const getAllWorkspaceMembersValidation = getWorkspaceMembersValidation;
