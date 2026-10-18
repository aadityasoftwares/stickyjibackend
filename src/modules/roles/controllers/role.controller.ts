import type { Request, Response, NextFunction } from "express";
import { RoleService } from "../services/role.service.js";
import { RoleMessages } from "../constants/role.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { IRoleFilter } from "../interfaces/role.interface.js";
import type { RoleScope, RoleType } from "../constants/role.enums.js";

export class RoleController {
    private readonly roleService: RoleService;

    constructor() {
        this.roleService = new RoleService();
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

    createRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const role = await this.roleService.createRole(
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(201).json(
                ResponseUtil.created(RoleMessages.CREATED, role),
            );
        } catch (error) {
            next(error);
        }
    };

    getRoleById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = this.resolveId(req);
            const role = await this.roleService.getRoleById(
                id,
                req.user?.id as string,
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(RoleMessages.FETCHED, role),
            );
        } catch (error) {
            next(error);
        }
    };

    getRoleByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const code = this.resolveCode(req);
            const workspaceId = typeof req.query.workspaceId === "string"
                ? req.query.workspaceId
                : typeof req.body?.workspaceId === "string"
                    ? req.body.workspaceId
                    : undefined;

            const role = await this.roleService.getRoleByCode(
                code,
                workspaceId,
                req.user?.id as string,
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(RoleMessages.FETCHED, role),
            );
        } catch (error) {
            next(error);
        }
    };

    getRoles = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const source = (req.method === "POST" ? req.body : req.query) ?? {};
            const parseBoolean = (val: unknown): boolean | undefined => {
                if (val === true || val === "true") return true;
                if (val === false || val === "false") return false;
                return undefined;
            };

            const filters: IRoleFilter = {
                page: source.page !== undefined ? Number(source.page) : undefined,
                limit: source.limit !== undefined ? Number(source.limit) : undefined,
                search: typeof source.search === "string" ? source.search : undefined,
                type: source.type as RoleType | undefined,
                scope: source.scope as RoleScope | undefined,
                workspaceId: typeof source.workspaceId === "string" ? source.workspaceId.trim() : undefined,
                isActive: parseBoolean(source.isActive),
                isSystem: parseBoolean(source.isSystem),
                sortBy: typeof source.sortBy === "string" ? source.sortBy : undefined,
                sortOrder: source.sortOrder as "asc" | "desc" | undefined,
            };

            const roles = await this.roleService.getRoles(
                filters,
                req.user?.id as string,
                res.locals.workspaceAuth ?? res.locals.globalAuth,
            );

            return res.status(200).json(
                ResponseUtil.paginated(
                    RoleMessages.FETCHED_ALL,
                    roles.data,
                    roles.pagination.page,
                    roles.pagination.limit,
                    roles.pagination.total,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    updateRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = this.resolveId(req);
            const { id: _bodyId, ...updatePayload } = req.body;

            const role = await this.roleService.updateRole(
                id,
                updatePayload,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(RoleMessages.UPDATED, role),
            );
        } catch (error) {
            next(error);
        }
    };

    changeRoleStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = this.resolveId(req);
            const role = await this.roleService.changeRoleStatus(
                id,
                req.body.isActive,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(RoleMessages.UPDATED, role),
            );
        } catch (error) {
            next(error);
        }
    };

    deleteRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = this.resolveId(req);
            await this.roleService.deleteRole(
                id,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(RoleMessages.DELETED),
            );
        } catch (error) {
            next(error);
        }
    };
}