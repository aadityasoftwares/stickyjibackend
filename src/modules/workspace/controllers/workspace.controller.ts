import type { WorkspaceListFilters } from "../validations/workspaceList.schema.js";
import type { WorkspaceDropdownFilters } from "../validations/workspaceDropdown.schema.js";
import type { Request, Response, NextFunction } from "express";
import { WorkspaceService } from "../services/workspace.service.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { WorkspaceStatus, WorkspaceVisibility } from "../constants/workspace.enums.js";
import type { IWorkspaceFilter, WorkspaceSortField } from "../interfaces/workspace.interface.js";

export class WorkspaceController {
    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }
    private readonly workspaceService: WorkspaceService;

    constructor() {
        this.workspaceService = new WorkspaceService();
    }

    createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspace = await this.workspaceService.createWorkspace(
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.globalAuth,
            );

            return res.status(201).json(ResponseUtil.created(WorkspaceMessages.CREATED, workspace));
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspace = await this.workspaceService.getWorkspaceById(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                res.locals.workspaceAuth,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.FETCHED, workspace));
        } catch (error) {
            next(error);
        }
    };

    getWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspaces = await this.workspaceService.getWorkspaces(
                req.user?.id as string,
                req.body as WorkspaceListFilters,
            );

            return res.status(200).json({
                ...ResponseUtil.success(WorkspaceMessages.FETCHED_ALL, workspaces.data),
                meta: {
                    ...workspaces.pagination,
                    counts: workspaces.counts,
                    accessFilters: workspaces.accessFilters,
                    statusFilters: workspaces.statusFilters,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    getMyWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspaces = await this.workspaceService.getMyWorkspaces(
                req.user?.id as string,
                this.getQueryFilters(req),
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        WorkspaceMessages.FETCHED_ALL,
                        workspaces.data,
                        workspaces.pagination.page,
                        workspaces.pagination.limit,
                        workspaces.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceDropdown = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dropdown = await this.workspaceService.getWorkspaceDropdown(
                req.user?.id as string,
                req.body as WorkspaceDropdownFilters,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.FETCHED_ALL, dropdown));
        } catch (error) {
            next(error);
        }
    };

    updateWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspace = await this.workspaceService.updateWorkspace(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.UPDATED, workspace));
        } catch (error) {
            next(error);
        }
    };

    updateWorkspaceStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspace = await this.workspaceService.updateWorkspaceStatus(
                RequestUtil.getParam(req.params.id),
                req.body.status,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.STATUS_UPDATED, workspace));
        } catch (error) {
            next(error);
        }
    };

    deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.workspaceService.deleteWorkspace(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    restoreWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspace = await this.workspaceService.restoreWorkspace(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.RESTORED, workspace));
        } catch (error) {
            next(error);
        }
    };

    permanentlyDeleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.workspaceService.permanentlyDeleteWorkspace(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMessages.PERMANENTLY_DELETED, result));
        } catch (error) {
            next(error);
        }
    };

    private getQueryFilters(req: Request): IWorkspaceFilter {
        return {
            page: req.query.page !== undefined ? Number(req.query.page) : undefined,
            limit: req.query.limit !== undefined ? Number(req.query.limit) : undefined,
            search: req.query.search as string | undefined,
            status: req.query.status as WorkspaceStatus | undefined,
            visibility: req.query.visibility as WorkspaceVisibility | undefined,
            isPersonal: req.query.isPersonal !== undefined ? req.query.isPersonal === "true" : undefined,
            sortBy: req.query.sortBy as WorkspaceSortField | undefined,
            sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
        };
    }
}
