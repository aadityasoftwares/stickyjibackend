import type { Request, Response, NextFunction } from "express";

import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogMessages } from "../constants/auditLog.messages.js";
import { AuditLogValidation } from "./auditLog.validation.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AuditLogAction, AuditLogActorType, AuditLogSeverity, AuditLogStatus } from "../constants/auditLog.enums.js";

export const getAuditLogsValidation = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page,
            limit,
            search,
            module,
            action,
            status,
            severity,
            actorType,
            actorId,
            resourceType,
            resourceId,
            workspaceId,
            startDate,
            endDate,
        } = req.query;

        if (page !== undefined) {
            const pageNumber = Number(page);

            if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_PAGE,
                        400
                    )
                );
            }
        }

        if (limit !== undefined) {
            const limitNumber = Number(limit);

            if (!Number.isInteger(limitNumber) || limitNumber <= 0) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_LIMIT,
                        400
                    )
                );
            }
        }

        if (search !== undefined) {
            if (typeof search !== "string") {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_SEARCH,
                        400
                    )
                );
            }
        }

        if (module !== undefined) {
            if (
                typeof module !== "string" ||
                !AuditLogValidation.modules.includes(module as AppModule)
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_MODULE,
                        400
                    )
                );
            }
        }

        if (action !== undefined) {
            if (
                typeof action !== "string" ||
                !AuditLogValidation.actions.includes(action as AuditLogAction)
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_ACTION,
                        400
                    )
                );
            }
        }

        if (status !== undefined) {
            if (
                typeof status !== "string" ||
                !AuditLogValidation.statuses.includes(status as AuditLogStatus)
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_STATUS,
                        400
                    )
                );
            }
        }

        if (severity !== undefined) {
            if (
                typeof severity !== "string" ||
                !AuditLogValidation.severities.includes(severity as AuditLogSeverity)
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_SEVERITY,
                        400
                    )
                );
            }
        }

        if (actorType !== undefined) {
            if (
                typeof actorType !== "string" ||
                !AuditLogValidation.actorTypes.includes(actorType as AuditLogActorType)
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_ACTOR_TYPE,
                        400
                    )
                );
            }
        }

        if (actorId !== undefined) {
            if (
                typeof actorId !== "string" ||
                !actorId.trim()
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_ACTOR_ID,
                        400
                    )
                );
            }
        }

        if (resourceType !== undefined) {
            if (
                typeof resourceType !== "string" ||
                !resourceType.trim()
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_RESOURCE_TYPE,
                        400
                    )
                );
            }
        }

        if (resourceId !== undefined) {
            if (
                typeof resourceId !== "string" ||
                !resourceId.trim()
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_RESOURCE_ID,
                        400
                    )
                );
            }
        }

        if (workspaceId !== undefined) {
            if (
                typeof workspaceId !== "string" ||
                !workspaceId.trim()
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_WORKSPACE_ID,
                        400
                    )
                );
            }
        }

        if (startDate !== undefined) {
            if (
                typeof startDate !== "string" ||
                Number.isNaN(Date.parse(startDate))
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_START_DATE,
                        400
                    )
                );
            }
        }

        if (endDate !== undefined) {
            if (
                typeof endDate !== "string" ||
                Number.isNaN(Date.parse(endDate))
            ) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_END_DATE,
                        400
                    )
                );
            }
        }

        if (
            startDate !== undefined &&
            endDate !== undefined &&
            typeof startDate === "string" &&
            typeof endDate === "string"
        ) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (start > end) {
                return next(
                    new AppError(
                        AuditLogMessages.INVALID_DATE_RANGE,
                        400
                    )
                );
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};