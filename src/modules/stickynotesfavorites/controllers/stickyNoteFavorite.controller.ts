import type { Request, Response, NextFunction } from "express";
import { StickyNoteFavoriteService } from "../services/stickyNoteFavorite.service.js";
import { StickyNoteFavoriteMessages } from "../constants/stickyNoteFavorite.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { StickyNoteFavoriteStatus } from "../constants/stickyNoteFavorite.enums.js";

export class StickyNoteFavoriteController {
    private readonly stickyNoteFavoriteService: StickyNoteFavoriteService;

    constructor() {
        this.stickyNoteFavoriteService = new StickyNoteFavoriteService();
    }

    private getAuditContext(req: Request) {
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId: (req as any).requestId ?? null,
        };
    }

    createStickyNoteFavorite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const stickyNoteId = req.body.stickyNoteId ?? req.body.noteId;

            const favorite = await this.stickyNoteFavoriteService.createStickyNoteFavorite(
                stickyNoteId,
                userId,
                this.getAuditContext(req),
            );

            return res.status(201).json(ResponseUtil.created(StickyNoteFavoriteMessages.CREATED, favorite));
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteFavoriteById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);

            const favorite = await this.stickyNoteFavoriteService.getStickyNoteFavoriteById(
                RequestUtil.getParam(req.params.id),
                userId,
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteFavoriteMessages.FETCHED, favorite));
        } catch (error) {
            next(error);
        }
    };

    checkStickyNoteFavorite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const stickyNoteId = RequestUtil.getParam(req.params.stickyNoteId);

            const result = await this.stickyNoteFavoriteService.checkStickyNoteFavorite(stickyNoteId, userId);

            return res
                .status(200)
                .json(
                    ResponseUtil.success(
                        result.isFavorite
                            ? StickyNoteFavoriteMessages.FETCHED
                            : StickyNoteFavoriteMessages.NOT_FAVORITED,
                        result,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteFavorites = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);
            const source = (req.method === "POST" ? req.body : req.query) ?? {};

            const page = Number(source.page) > 0 ? Number(source.page) : 1;
            const limit = Number(source.limit) > 0 ? Math.min(Number(source.limit), 100) : 10;

            const favorites = await this.stickyNoteFavoriteService.getStickyNoteFavorites(userId, {
                stickyNoteId: source.stickyNoteId ? String(source.stickyNoteId).trim() : undefined,
                workspaceId: source.workspaceId ? String(source.workspaceId).trim() : undefined,
                workspaceFolderId: source.workspaceFolderId ? String(source.workspaceFolderId).trim() : undefined,
                search: source.search ? String(source.search).trim() : undefined,
                status: source.status as StickyNoteFavoriteStatus | undefined,
                page,
                limit,
                sortBy: source.sortBy as string | undefined,
                sortOrder: source.sortOrder as "asc" | "desc" | undefined,
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        StickyNoteFavoriteMessages.FETCHED_ALL,
                        favorites.data,
                        favorites.pagination.page,
                        favorites.pagination.limit,
                        favorites.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteFavoriteStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);

            const favorite = await this.stickyNoteFavoriteService.updateStickyNoteFavoriteStatus(
                RequestUtil.getParam(req.params.id),
                req.body.status,
                userId,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteFavoriteMessages.FETCHED, favorite));
        } catch (error) {
            next(error);
        }
    };

    deleteStickyNoteFavorite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);

            const favorite = await this.stickyNoteFavoriteService.deleteStickyNoteFavorite(
                RequestUtil.getParam(req.params.id),
                userId,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteFavoriteMessages.DELETED, favorite));
        } catch (error) {
            next(error);
        }
    };

    restoreStickyNoteFavorite = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = (req.user?.id as string) ?? RequestUtil.getUserId(req);

            const favorite = await this.stickyNoteFavoriteService.restoreStickyNoteFavorite(
                RequestUtil.getParam(req.params.id),
                userId,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteFavoriteMessages.RESTORED, favorite));
        } catch (error) {
            next(error);
        }
    };
}
