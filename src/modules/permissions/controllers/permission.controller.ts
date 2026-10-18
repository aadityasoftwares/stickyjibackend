import type { Request, Response, NextFunction } from "express";
import { PermissionService } from "../services/permission.service.js";
import { PermissionMessages } from "../constants/permission.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { IPermissionFilter } from "../interfaces/permission.interface.js";
import type { PermissionAccess, PermissionAction } from "../constants/permission.enums.js";

export class PermissionController {
    private readonly permissionService: PermissionService;

    constructor() {
        this.permissionService = new PermissionService();
    }

    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    private resolveId(req: Request): string {
        return RequestUtil.getParam(req.params.id ?? req.body?.id ?? req.query.id);
    }

    private resolveCode(req: Request): string {
        return RequestUtil.getParam(req.params.code ?? req.body?.code ?? req.query.code);
    }

    createPermission = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const permission = await this.permissionService.createPermission(
                req.body,
                req.user?.id,
                this.getAuditContext(req),
            );

            return res.status(201).json(ResponseUtil.created(PermissionMessages.CREATED, permission));
        } catch (error) {
            next(error);
        }
    };

    getPermissionById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const permission = await this.permissionService.getPermissionById(this.resolveId(req));

            return res.status(200).json(ResponseUtil.success(PermissionMessages.FETCHED, permission));
        } catch (error) {
            next(error);
        }
    };

    getPermissionByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const permission = await this.permissionService.getPermissionByCode(this.resolveCode(req));

            return res.status(200).json(ResponseUtil.success(PermissionMessages.FETCHED, permission));
        } catch (error) {
            next(error);
        }
    };

    getPermissions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const source = (req.method === "POST" ? req.body : req.query) ?? {};
            const parseBoolean = (val: unknown): boolean | undefined => {
                if (val === true || val === "true") return true;
                if (val === false || val === "false") return false;
                return undefined;
            };

            const filters: IPermissionFilter = {
                page: source.page !== undefined ? Number(source.page) : undefined,
                limit: source.limit !== undefined ? Number(source.limit) : undefined,
                search: typeof source.search === "string" ? source.search : undefined,
                module: typeof source.module === "string" ? source.module : undefined,
                action: source.action as PermissionAction | undefined,
                access: source.access as PermissionAccess | undefined,
                isSystem: parseBoolean(source.isSystem),
                isActive: parseBoolean(source.isActive),
                sortBy: typeof source.sortBy === "string" ? source.sortBy : undefined,
                sortOrder: source.sortOrder as "asc" | "desc" | undefined,
            };

            const permissions = await this.permissionService.getPermissions(filters);

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        PermissionMessages.FETCHED_ALL,
                        permissions.data,
                        permissions.pagination.page,
                        permissions.pagination.limit,
                        permissions.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    getGroupedPermissions = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const permissions = await this.permissionService.getGroupedPermissions();

            return res
                .status(200)
                .json(ResponseUtil.success(PermissionMessages.FETCHED_GROUPED, permissions));
        } catch (error) {
            next(error);
        }
    };

    updatePermission = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = this.resolveId(req);
            const { id: _bodyId, ...payload } = req.body;

            const permission = await this.permissionService.updatePermission(
                id,
                payload,
                req.user?.id,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PermissionMessages.UPDATED, permission));
        } catch (error) {
            next(error);
        }
    };

    deletePermission = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.permissionService.deletePermission(
                this.resolveId(req),
                req.user?.id,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PermissionMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changePermissionStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const permission = await this.permissionService.changePermissionStatus(
                this.resolveId(req),
                req.body.isActive,
                req.user?.id,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PermissionMessages.UPDATED, permission));
        } catch (error) {
            next(error);
        }
    };
}
