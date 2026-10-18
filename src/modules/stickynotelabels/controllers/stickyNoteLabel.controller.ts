import type {
    Request,
    Response,
    NextFunction,
} from "express";

import { StickyNoteLabelService } from "../services/stickyNoteLabel.service.js";
import { StickyNoteLabelMessages } from "../constants/stickyNoteLabel.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

import type {
    StickyNoteLabelColor,
    StickyNoteLabelStatus,
} from "../constants/stickyNoteLabel.enums.js";

export class StickyNoteLabelController {
    private stickyNoteLabelService: StickyNoteLabelService;

    constructor() {
        this.stickyNoteLabelService = new StickyNoteLabelService();
    }

    createStickyNoteLabel = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const label =
                await this.stickyNoteLabelService.createStickyNoteLabel(
                    req.body,
                    req.user?.id as string,
                );

            return res.status(201).json(
                ResponseUtil.created(
                    StickyNoteLabelMessages.CREATED,
                    label,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteLabelById = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const label =
                await this.stickyNoteLabelService.getStickyNoteLabelById(
                    RequestUtil.getParam(req.params.id),
                );

            return res.status(200).json(
                ResponseUtil.success(
                    StickyNoteLabelMessages.FETCHED,
                    label,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteLabels = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const labels =
                await this.stickyNoteLabelService.getStickyNoteLabels({
                    workspaceId: req.query.workspaceId as string,
                    search: req.query.search as string,
                    color: req.query.color as StickyNoteLabelColor,
                    status: req.query.status as StickyNoteLabelStatus,
                    createdBy: req.query.createdBy as string,
                    page: Number(req.query.page) || 1,
                    limit: Number(req.query.limit) || 10,
                    sortBy: req.query.sortBy as string,
                    sortOrder: req.query.sortOrder as "asc" | "desc",
                });

            return res.status(200).json(
                ResponseUtil.paginated(
                    StickyNoteLabelMessages.FETCHED_ALL,
                    labels.data,
                    labels.pagination.page,
                    labels.pagination.limit,
                    labels.pagination.total,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteLabel = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const label =
                await this.stickyNoteLabelService.updateStickyNoteLabel(
                    RequestUtil.getParam(req.params.id),
                    req.body,
                    req.user?.id as string,
                );

            return res.status(200).json(
                ResponseUtil.success(
                    StickyNoteLabelMessages.UPDATED,
                    label,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteLabelStatus = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const label =
                await this.stickyNoteLabelService.updateStickyNoteLabelStatus(
                    RequestUtil.getParam(req.params.id),
                    req.body.status,
                    req.user?.id as string,
                );

            return res.status(200).json(
                ResponseUtil.success(
                    StickyNoteLabelMessages.STATUS_UPDATED,
                    label,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    deleteStickyNoteLabel = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            await this.stickyNoteLabelService.deleteStickyNoteLabel(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res.status(200).json(
                ResponseUtil.success(
                    StickyNoteLabelMessages.DELETED,
                ),
            );
        } catch (error) {
            next(error);
        }
    };

    restoreStickyNoteLabel = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ) => {
        try {
            const label =
                await this.stickyNoteLabelService.restoreStickyNoteLabel(
                    RequestUtil.getParam(req.params.id),
                    req.user?.id as string,
                );

            return res.status(200).json(
                ResponseUtil.success(
                    StickyNoteLabelMessages.RESTORED,
                    label,
                ),
            );
        } catch (error) {
            next(error);
        }
    };
}