import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogMessages } from "../constants/auditLog.messages.js";
import { AuditLogValidation } from "./auditLog.validation.js";

export const createAuditLogValidation = (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            actorId,
            actorType,
            action,
            module,
            resourceType,
            resourceId,
            resourceName,
            description,
            status,
            severity,
            changes,
            metadata,
            ipAddress,
            userAgent,
            requestId,
            workspaceId,
        } = req.body;

        if (actorType !== undefined && actorType !== null) {
            if (!AuditLogValidation.actorTypes.includes(actorType)) {
                return next(new AppError(AuditLogMessages.INVALID_ACTOR_TYPE, 400));
            }
        }

        if (!action) {
            return next(new AppError(AuditLogMessages.ACTION_REQUIRED, 400));
        }

        if (!AuditLogValidation.actions.includes(action)) {
            return next(new AppError(AuditLogMessages.INVALID_ACTION, 400));
        }

        if (!module) {
            return next(new AppError(AuditLogMessages.MODULE_REQUIRED, 400));
        }

        if (!AuditLogValidation.modules.includes(module)) {
            return next(new AppError(AuditLogMessages.INVALID_MODULE, 400));
        }

        if (!description) {
            return next(new AppError(AuditLogMessages.DESCRIPTION_REQUIRED, 400));
        }

        if (typeof description !== "string" || !description.trim()) {
            return next(new AppError(AuditLogMessages.INVALID_DESCRIPTION, 400));
        }

        if (status !== undefined && status !== null) {
            if (!AuditLogValidation.statuses.includes(status)) {
                return next(new AppError(AuditLogMessages.INVALID_STATUS, 400));
            }
        }

        if (severity !== undefined && severity !== null) {
            if (!AuditLogValidation.severities.includes(severity)) {
                return next(new AppError(AuditLogMessages.INVALID_SEVERITY, 400));
            }
        }

        if (actorId !== undefined && actorId !== null) {
            if (typeof actorId !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_ACTOR_ID, 400));
            }
        }

        if (resourceType !== undefined && resourceType !== null) {
            if (typeof resourceType !== "string" || !resourceType.trim()) {
                return next(new AppError(AuditLogMessages.INVALID_RESOURCE_TYPE, 400));
            }
        }

        if (resourceId !== undefined && resourceId !== null) {
            if (typeof resourceId !== "string" && typeof resourceId !== "number") {
                return next(new AppError(AuditLogMessages.INVALID_RESOURCE_ID, 400));
            }
        }

        if (resourceName !== undefined && resourceName !== null) {
            if (typeof resourceName !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_RESOURCE_NAME, 400));
            }
        }

        if (changes !== undefined && changes !== null) {
            if (!Array.isArray(changes)) {
                return next(new AppError(AuditLogMessages.INVALID_CHANGES, 400));
            }

            for (const change of changes) {
                if (!change || typeof change !== "object") {
                    return next(new AppError(AuditLogMessages.INVALID_CHANGES, 400));
                }

                if (!("field" in change) || typeof change.field !== "string" || !change.field.trim()) {
                    return next(new AppError(AuditLogMessages.INVALID_CHANGE_FIELD, 400));
                }
            }
        }

        if (metadata !== undefined && metadata !== null) {
            if (typeof metadata !== "object" || Array.isArray(metadata)) {
                return next(new AppError(AuditLogMessages.INVALID_METADATA, 400));
            }
        }

        if (ipAddress !== undefined && ipAddress !== null) {
            if (typeof ipAddress !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_IP_ADDRESS, 400));
            }
        }

        if (userAgent !== undefined && userAgent !== null) {
            if (typeof userAgent !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_USER_AGENT, 400));
            }
        }

        if (requestId !== undefined && requestId !== null) {
            if (typeof requestId !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_REQUEST_ID, 400));
            }
        }

        if (workspaceId !== undefined && workspaceId !== null) {
            if (typeof workspaceId !== "string") {
                return next(new AppError(AuditLogMessages.INVALID_WORKSPACE_ID, 400));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};
