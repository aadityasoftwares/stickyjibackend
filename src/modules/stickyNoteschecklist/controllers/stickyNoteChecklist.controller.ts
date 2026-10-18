import type { Request, Response, NextFunction } from "express";

import { StickyNoteChecklistService } from "../services/stickyNoteChecklist.service.js";

import { StickyNoteChecklistMessages } from "../constants/stickyNoteChecklist.messages.js";

import { ResponseUtil } from "../../../utils/response.util.js";

import { RequestUtil } from "../../../utils/request.util.js";

import type { StickyNoteChecklistStatus } from "../constants/stickyNoteChecklist.enums.js";

import type { StickyNoteChecklistSortField } from "../interfaces/stickyNoteChecklist.interface.js";

export class StickyNoteChecklistController {
    private readonly stickyNoteChecklistService: StickyNoteChecklistService;

    constructor() {
        this.stickyNoteChecklistService = new StickyNoteChecklistService();
    }

    createStickyNoteChecklist = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const checklist = await this.stickyNoteChecklistService.createStickyNoteChecklist(
                req.body,
                req.user?.id as string,
            );

            return res.status(201).json(ResponseUtil.created(StickyNoteChecklistMessages.CREATED, checklist));
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteChecklistById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const checklist = await this.stickyNoteChecklistService.getStickyNoteChecklistById(
                RequestUtil.getParam(req.params.id ?? req.query.id),
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteChecklistMessages.FETCHED, checklist));
        } catch (error) {
            next(error);
        }
    };

    getStickyNoteChecklists = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const source = (req.method === "POST" ? req.body : req.query) ?? {};
            const checklists = await this.stickyNoteChecklistService.getStickyNoteChecklists({
                stickyNoteId:
                    typeof source.stickyNoteId === "string"
                        ? source.stickyNoteId.trim()
                        : (source.stickyNoteId as string),
                search: typeof source.search === "string" ? source.search : undefined,
                status: source.status as StickyNoteChecklistStatus | undefined,
                createdBy: typeof source.createdBy === "string" ? source.createdBy.trim() : undefined,
                page: source.page !== undefined ? Number(source.page) : undefined,
                limit: source.limit !== undefined ? Number(source.limit) : undefined,
                sortBy: source.sortBy as StickyNoteChecklistSortField | undefined,
                sortOrder: source.sortOrder as "asc" | "desc" | undefined,
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        StickyNoteChecklistMessages.FETCHED_ALL,
                        checklists.data,
                        checklists.pagination.page,
                        checklists.pagination.limit,
                        checklists.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteChecklist = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const checklist = await this.stickyNoteChecklistService.updateStickyNoteChecklist(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as string,
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteChecklistMessages.UPDATED, checklist));
        } catch (error) {
            next(error);
        }
    };

    updateStickyNoteChecklistStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const checklist = await this.stickyNoteChecklistService.updateStickyNoteChecklistStatus(
                RequestUtil.getParam(req.params.id),
                req.body.status,
                req.user?.id as string,
            );

            return res
                .status(200)
                .json(ResponseUtil.success(StickyNoteChecklistMessages.STATUS_UPDATED, checklist));
        } catch (error) {
            next(error);
        }
    };

    deleteStickyNoteChecklist = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.stickyNoteChecklistService.deleteStickyNoteChecklist(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res.status(200).json(ResponseUtil.success(StickyNoteChecklistMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    restoreStickyNoteChecklist = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const checklist = await this.stickyNoteChecklistService.restoreStickyNoteChecklist(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res
                .status(200)
                .json(ResponseUtil.success(StickyNoteChecklistMessages.RESTORED, checklist));
        } catch (error) {
            next(error);
        }
    };
}
