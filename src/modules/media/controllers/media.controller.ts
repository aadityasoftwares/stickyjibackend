import type { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { MediaMessages } from "../constants/media.messages.js";
import { MediaService } from "../services/media.service.js";

export class MediaController {
    private readonly mediaService: MediaService;

    constructor() {
        this.mediaService = new MediaService();
    }

    requestUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.mediaService.requestUpload(req.body, req.user?.id as string);

            return res.status(201).json(ResponseUtil.created(MediaMessages.UPLOAD_URL_CREATED, result));
        } catch (error) {
            next(error);
        }
    };

    completeUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const media = await this.mediaService.completeUpload(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res.status(200).json(ResponseUtil.success(MediaMessages.UPLOAD_COMPLETED, media));
        } catch (error) {
            next(error);
        }
    };

    get = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const media = await this.mediaService.getMedia(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res.status(200).json(ResponseUtil.success(MediaMessages.FETCHED, media));
        } catch (error) {
            next(error);
        }
    };

    getDownloadUrl = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.mediaService.getDownloadUrl(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
            );

            return res.status(200).json(ResponseUtil.success(MediaMessages.DOWNLOAD_URL_CREATED, result));
        } catch (error) {
            next(error);
        }
    };

    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const media = await this.mediaService.getMediaFiles(req.user?.id as string, {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                mediaType: req.query.mediaType as any,
                purpose: req.query.purpose as any,
                status: req.query.status as any,
                visibility: req.query.visibility as any,
                resourceType: req.query.resourceType as any,
                resourceId: req.query.resourceId as string,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        MediaMessages.FETCHED_ALL,
                        media.data,
                        media.pagination.page,
                        media.pagination.limit,
                        media.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const media = await this.mediaService.updateMedia(
                RequestUtil.getParam(req.params.id),
                req.user?.id as string,
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(MediaMessages.UPDATED, media));
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.mediaService.deleteMedia(RequestUtil.getParam(req.params.id), req.user?.id as string);

            return res.status(200).json(ResponseUtil.success(MediaMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };
}
