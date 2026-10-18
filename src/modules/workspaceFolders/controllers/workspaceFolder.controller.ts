import type { Request, Response, NextFunction } from "express";
import { WorkspaceFolderService } from "../services/workspaceFolder.service.js";
import { WorkspaceFolderMessages } from "../constants/workspaceFolder.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type {
    IWorkspaceFolderFilter,
} from "../interfaces/workspaceFolder.interface.js";

export class WorkspaceFolderController {
    private readonly workspaceFolderService: WorkspaceFolderService;

    constructor() {
        this.workspaceFolderService = new WorkspaceFolderService();
    }

    createWorkspaceFolder = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folder = await this.workspaceFolderService.createWorkspaceFolder(
                req.body,
                req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );

            return res.status(201).json(
                ResponseUtil.created(
                    WorkspaceFolderMessages.CREATED,
                    folder,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceFolderById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folder = await this.workspaceFolderService.getWorkspaceFolderById(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    WorkspaceFolderMessages.FETCHED,
                    folder,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceFolders = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folders = await this.workspaceFolderService.getWorkspaceFolders(
                req.user?.id as string,
                req.body as IWorkspaceFolderFilter, res.locals.workspaceAuth,
            );

            return res.status(200).json(
                { ...ResponseUtil.success(WorkspaceFolderMessages.FETCHED_ALL, folders.data), meta: { ...folders.pagination, counts: folders.counts, ...(folders.allowedActions ? { allowedActions: folders.allowedActions } : {}), statusFilters: folders.statusFilters } },
            );
        } catch (error) {
            next(error);
        }
    };

    getMyWorkspaceFolders = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folders = await this.workspaceFolderService.getMyWorkspaceFolders(
                req.user?.id as string,
                req.body as IWorkspaceFolderFilter, res.locals.workspaceAuth,
            );

            return res.status(200).json(
                { ...ResponseUtil.success(WorkspaceFolderMessages.FETCHED_ALL, folders.data), meta: { ...folders.pagination, counts: folders.counts, ...(folders.allowedActions ? { allowedActions: folders.allowedActions } : {}), statusFilters: folders.statusFilters } },
            );
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceFoldersByWorkspace = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const workspaceId = RequestUtil.getParam(req.params.workspaceId);
            const queryFilters = req.body as IWorkspaceFolderFilter;
            const folders = await this.workspaceFolderService.getWorkspaceFolders(
                req.user?.id as string,
                {
                    ...queryFilters,
                    workspaceId,
                }, res.locals.workspaceAuth,
            );

            return res.status(200).json(
                { ...ResponseUtil.success(WorkspaceFolderMessages.FETCHED_ALL, folders.data), meta: { ...folders.pagination, counts: folders.counts, ...(folders.allowedActions ? { allowedActions: folders.allowedActions } : {}), statusFilters: folders.statusFilters } },
            );
        } catch (error) {
            next(error);
        }
    };

    updateWorkspaceFolder = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folder = await this.workspaceFolderService.updateWorkspaceFolder(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    WorkspaceFolderMessages.UPDATED,
                    folder,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    updateWorkspaceFolderStatus = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folder = await this.workspaceFolderService.updateWorkspaceFolderStatus(
                RequestUtil.getParam(req.params.id),
                req.body.status,
                req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    WorkspaceFolderMessages.STATUS_UPDATED,
                    folder,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    deleteWorkspaceFolder = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            await this.workspaceFolderService.deleteWorkspaceFolder(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    WorkspaceFolderMessages.DELETED,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    restoreWorkspaceFolder = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const folder = await this.workspaceFolderService.restoreWorkspaceFolder(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    WorkspaceFolderMessages.RESTORED,
                    folder,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    permanentlyDeleteWorkspaceFolder = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.workspaceFolderService.permanentlyDeleteWorkspaceFolder(
                RequestUtil.getParam(req.params.id), req.user?.id as string,
                this.getAuditContext(req), res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceFolderMessages.PERMANENTLY_DELETED, result));
        } catch (error) { next(error); }
    };

    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return { actorId: req.user?.id ?? null, ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null, requestId };
    }
}
