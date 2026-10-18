import type { Request, Response, NextFunction } from "express";
import { StickyNoteColumnService } from "../services/stickyNoteColumn.service.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class StickyNoteColumnController {
    private readonly stickyNoteColumnService: StickyNoteColumnService;

    constructor() {
        this.stickyNoteColumnService = new StickyNoteColumnService();
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

    createStickyNoteColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = RequestUtil.getUserId(req);
            const column = await this.stickyNoteColumnService.createStickyNoteColumn(
                req.body,
                userId,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            res.status(201).json(ResponseUtil.created(StickyNoteColumnMessages.CREATED, column));
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteColumnById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = RequestUtil.getUserId(req);
            const column = await this.stickyNoteColumnService.getStickyNoteColumnById(
                id,
                userId,
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.FETCHED, column));
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteColumns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const rawWorkspaceId = (req.body?.workspaceId ?? req.query?.workspaceId) as string;
            const rawWorkspaceFolderId = (req.body?.workspaceFolderId ?? req.query?.workspaceFolderId) as string;
            const workspaceId = RequestUtil.getParam(rawWorkspaceId);
            const workspaceFolderId = RequestUtil.getParam(rawWorkspaceFolderId);
            const userId = RequestUtil.getUserId(req);
            const columns = await this.stickyNoteColumnService.getStickyNoteColumns(
                workspaceId,
                workspaceFolderId,
                userId,
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.FETCHED_ALL, columns));
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = RequestUtil.getUserId(req);
            const column = await this.stickyNoteColumnService.updateStickyNoteColumn(
                id,
                req.body,
                userId,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.UPDATED, column));
        } catch (error) {
            next(error);
        }
    };

    reorderStickyNoteColumns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = RequestUtil.getUserId(req);
            const columns = await this.stickyNoteColumnService.reorderStickyNoteColumns(
                req.body,
                userId,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.REORDERED, columns));
        } catch (error) {
            next(error);
        }
    };

    reorderStickyNoteColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = RequestUtil.getUserId(req);
            const column = await this.stickyNoteColumnService.reorderStickyNoteColumn(
                id,
                req.body,
                userId,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.REORDERED, column));
        } catch (error) {
            next(error);
        }
    };

    deleteStickyNoteColumn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = RequestUtil.getUserId(req);
            await this.stickyNoteColumnService.deleteStickyNoteColumn(
                id,
                userId,
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );
            res.status(200).json(ResponseUtil.success(StickyNoteColumnMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };
}
