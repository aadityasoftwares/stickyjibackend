import type { NextFunction, Request, Response } from "express";

import { RequestUtil } from "../../../utils/request.util.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { StickyNoteAssigneeMessages } from "../constants/stickyNoteAssignee.messages.js";
import type { StickyNoteAssigneeStatus } from "../constants/stickyNoteAssignee.enums.js";
import type { StickyNoteAssigneeSortField } from "../interfaces/stickyNoteAssignee.interface.js";
import { StickyNoteAssigneeService } from "../services/stickyNoteAssignee.service.js";

export class StickyNoteAssigneeController {
    private readonly stickyNoteAssigneeService: StickyNoteAssigneeService;

    constructor() {
        this.stickyNoteAssigneeService = new StickyNoteAssigneeService();
    }

    private getAuditContext(req: Request) {
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId: (req as any).requestId ?? null,
        };
    }

    createStickyNoteAssignee = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const assignee = await this.stickyNoteAssigneeService.createStickyNoteAssignee(
                req.body,
                userId,
                this.getAuditContext(req),
            );

            return res
                .status(201)
                .json(
                    ResponseUtil.created(
                        StickyNoteAssigneeMessages.CREATED,
                        assignee,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    getStickyNoteAssigneeById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const assignee = await this.stickyNoteAssigneeService.getStickyNoteAssigneeById(
                RequestUtil.getParam(req.params.id),
                userId,
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        StickyNoteAssigneeMessages.FETCHED,
                        assignee,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    getAssigneesByStickyNoteId = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const stickyNoteId =
                req.params.stickyNoteId ?? req.params.id;

            const assignees = await this.stickyNoteAssigneeService.getAssigneesByStickyNoteId(
                RequestUtil.getParam(stickyNoteId),
                userId,
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        StickyNoteAssigneeMessages.FETCHED_ALL,
                        assignees,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    getStickyNoteAssignees = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const source = (req.method === "POST" ? req.body : req.query) ?? {};

            const result = await this.stickyNoteAssigneeService.getStickyNoteAssignees(
                {
                    workspaceId: this.getQueryString(source.workspaceId),
                    stickyNoteId: this.getQueryString(source.stickyNoteId),
                    userId: this.getQueryString(source.userId),
                    status: source.status as StickyNoteAssigneeStatus | undefined,
                    page: this.getPositiveNumber(source.page, 1),
                    limit: this.getPositiveNumber(source.limit, 20),
                    sortBy: source.sortBy as StickyNoteAssigneeSortField | undefined,
                    sortOrder: source.sortOrder as "asc" | "desc" | undefined,
                },
                userId,
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        StickyNoteAssigneeMessages.FETCHED_ALL,
                        result.data,
                        result.pagination.page,
                        result.pagination.limit,
                        result.pagination.total,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    syncStickyNoteAssignees = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const stickyNoteId =
                req.params.stickyNoteId ?? req.params.id;

            const assignees = await this.stickyNoteAssigneeService.syncStickyNoteAssignees(
                RequestUtil.getParam(stickyNoteId),
                req.body,
                userId,
                this.getAuditContext(req),
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        StickyNoteAssigneeMessages.SYNCED,
                        assignees,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    removeStickyNoteAssignee = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const assignee = await this.stickyNoteAssigneeService.removeStickyNoteAssignee(
                RequestUtil.getParam(req.params.id),
                userId,
                this.getAuditContext(req),
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        StickyNoteAssigneeMessages.REMOVED,
                        assignee,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    restoreStickyNoteAssignee = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const assignee = await this.stickyNoteAssigneeService.restoreStickyNoteAssignee(
                RequestUtil.getParam(req.params.id),
                userId,
                this.getAuditContext(req),
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        StickyNoteAssigneeMessages.RESTORED,
                        assignee,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    private getQueryString(value: unknown): string | undefined {
        if (typeof value !== "string") {
            return undefined;
        }

        const normalized = value.trim();
        return normalized || undefined;
    }

    private getPositiveNumber(value: unknown, fallback: number): number {
        const parsed = Number(value);

        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    }
}
