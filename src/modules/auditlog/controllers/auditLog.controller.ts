import type { Request, Response, NextFunction } from "express";

import { AuditLogService } from "../services/auditLog.service.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class AuditLogController {
    private auditLogService: AuditLogService;

    constructor() {
        this.auditLogService = new AuditLogService();
    }

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = RequestUtil.getParam(req.params.id);

            const auditLog = await this.auditLogService.getById(id);

            return res.status(200).json(ResponseUtil.success("Audit log fetched successfully.", auditLog));
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.auditLogService.getAll({
                page: req.query.page ? Number(req.query.page) : 1,

                limit: req.query.limit ? Number(req.query.limit) : 20,

                search: req.query.search as string | undefined,

                module: req.query.module as any,

                action: req.query.action as any,

                status: req.query.status as any,

                severity: req.query.severity as any,

                actorType: req.query.actorType as any,

                actorId: req.query.actorId as string | undefined,

                resourceType: req.query.resourceType as string | undefined,

                resourceId: req.query.resourceId as string | undefined,

                workspaceId: req.query.workspaceId as string | undefined,

                startDate: req.query.startDate as string | undefined,

                endDate: req.query.endDate as string | undefined,

                sortBy: req.query.sortBy as string | undefined,

                sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        "Audit logs fetched successfully.",
                        result.data,
                        result.pagination.page,
                        result.pagination.limit,
                        result.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };
}
