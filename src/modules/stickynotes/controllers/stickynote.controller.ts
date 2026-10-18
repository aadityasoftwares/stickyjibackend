import type { Request, Response, NextFunction } from "express";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import type {
    IStickyNoteCreate,
    IStickyNoteUpdate,
    IStickyNoteFilter,
    IStickyNoteReorder,
    IStickyNoteOverdueFilter,
} from "../interfaces/stickyNote.interface.js";
import type { StickyNoteStatus } from "../constants/stickyNote.enums.js";
import { StickyNoteService } from "../services/stickyNote.service.js";

type StickyNoteRequest<T> = Request<Request["params"], unknown, T>;
export class StickyNoteController {
    private readonly stickyNoteService = new StickyNoteService();
    private getAuditContext(req: Request): IAuditLogContext {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }
    createStickyNote = async (
        req: StickyNoteRequest<IStickyNoteCreate>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.createStickyNote(
                req.body,
                userId,
                this.getAuditContext(req),
            );
            res.status(201).json(ResponseUtil.created(StickyNoteMessages.CREATED, result));
        } catch (error) {
            next(error);
        }
    };
    getOverdueStickyNotes = async (
        req: StickyNoteRequest<unknown>,
        res: Response<unknown, { stickyNoteOverdueFilters: IStickyNoteOverdueFilter }>,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.getOverdueStickyNotes(
                res.locals.stickyNoteOverdueFilters,
                userId,
            );
            res.status(200).json({
                ...ResponseUtil.success(StickyNoteMessages.OVERDUE_FETCHED, result.data),
                meta: result.pagination,
            });
        } catch (error) {
            next(error);
        }
    };
    bringOverdueStickyNotesToToday = async (
        req: StickyNoteRequest<{ stickyNoteIds: string[] }>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.bringOverdueStickyNotesToToday(
                req.body.stickyNoteIds,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.OVERDUE_BROUGHT_TO_TODAY, result));
        } catch (error) {
            next(error);
        }
    };
    getStickyNoteById = async (
        req: StickyNoteRequest<unknown>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.getStickyNoteById(id, userId);
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };
    getStickyNotes = async (
        req: StickyNoteRequest<unknown>,
        res: Response<unknown, { stickyNoteFilters: IStickyNoteFilter }>,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.getStickyNotes(res.locals.stickyNoteFilters, userId);
            res.status(200).json(
                ResponseUtil.paginated(
                    StickyNoteMessages.FETCHED_ALL,
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
    updateStickyNote = async (
        req: StickyNoteRequest<IStickyNoteUpdate>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.updateStickyNote(
                id,
                req.body,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.UPDATED, result));
        } catch (error) {
            next(error);
        }
    };
    updateStickyNoteStatus = async (
        req: StickyNoteRequest<{ status: StickyNoteStatus }>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.updateStickyNoteStatus(
                id,
                req.body.status,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.STATUS_UPDATED, result));
        } catch (error) {
            next(error);
        }
    };
    reorderStickyNote = async (
        req: StickyNoteRequest<IStickyNoteReorder>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.reorderStickyNote(
                id,
                req.body,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.REORDERED, result));
        } catch (error) {
            next(error);
        }
    };
    deleteStickyNote = async (
        req: StickyNoteRequest<unknown>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            await this.stickyNoteService.deleteStickyNote(id, userId, this.getAuditContext(req));
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };
    permanentlyDeleteStickyNote = async (
        req: StickyNoteRequest<unknown>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.permanentlyDeleteStickyNote(
                id,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.PERMANENTLY_DELETED, result));
        } catch (error) {
            next(error);
        }
    };
    restoreStickyNote = async (
        req: StickyNoteRequest<unknown>,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const id = RequestUtil.getParam(req.params.id);
            const userId = req.user?.id ?? RequestUtil.getUserId(req);
            const result = await this.stickyNoteService.restoreStickyNote(
                id,
                userId,
                this.getAuditContext(req),
            );
            res.status(200).json(ResponseUtil.success(StickyNoteMessages.RESTORED, result));
        } catch (error) {
            next(error);
        }
    };
}
