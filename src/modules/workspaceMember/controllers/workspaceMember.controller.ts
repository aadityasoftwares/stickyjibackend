import type { Request, Response, NextFunction } from "express";
import { WorkspaceMemberService } from "../services/workspaceMember.service.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { IWorkspaceMemberFilter } from "../interfaces/workspaceMember.interface.js";

export class WorkspaceMemberController {
    private readonly workspaceMemberService: WorkspaceMemberService;

    constructor() {
        this.workspaceMemberService = new WorkspaceMemberService();
    }

    createWorkspaceMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const member = await this.workspaceMemberService.createWorkspaceMember(
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(201).json(ResponseUtil.created(WorkspaceMemberMessages.CREATED, member));
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceMemberById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const member = await this.workspaceMemberService.getWorkspaceMemberById(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMemberMessages.FETCHED, member));
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceMembers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters = (res.locals.memberFilters ?? (req.method === "POST" ? req.body : req.query)) as IWorkspaceMemberFilter;
            const members = await this.workspaceMemberService.getWorkspaceMembers(
                filters,
                req.user?.id as string,
                res.locals.workspaceAuth,
            );
            return res.status(200).json({
                ...ResponseUtil.success(WorkspaceMemberMessages.FETCHED_ALL, members.data),
                meta: members.pagination,
            });
        } catch (error) {
            next(error);
        }
    };

    updateWorkspaceMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const member = await this.workspaceMemberService.updateWorkspaceMember(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMemberMessages.UPDATED, member));
        } catch (error) {
            next(error);
        }
    };

    assignRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const member = await this.workspaceMemberService.assignRole(
                RequestUtil.getParam(req.params.id),
                req.body.roleId,
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMemberMessages.ROLE_ASSIGNED, member));
        } catch (error) {
            next(error);
        }
    };

    removeWorkspaceMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.workspaceMemberService.removeWorkspaceMember(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMemberMessages.REMOVED));
        } catch (error) {
            next(error);
        }
    };

    restoreWorkspaceMember = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const member = await this.workspaceMemberService.restoreWorkspaceMember(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            return res.status(200).json(ResponseUtil.success(WorkspaceMemberMessages.RESTORED, member));
        } catch (error) {
            next(error);
        }
    };

    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }
}
