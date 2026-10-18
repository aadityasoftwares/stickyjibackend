import type { Request, Response, NextFunction } from "express";
import { FeatureService } from "../services/feature.service.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class FeatureController {
    private featureService: FeatureService;

    constructor() {
        this.featureService = new FeatureService();
    }

    createFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const feature = await this.featureService.createFeature(req.body);
            return res.status(201).json(ResponseUtil.created(FeatureMessages.CREATED, feature));
        } catch (error) {
            next(error);
        }
    };

    getFeatureById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const feature = await this.featureService.getFeatureById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(FeatureMessages.FETCHED, feature));
        } catch (error) {
            next(error);
        }
    };

    getFeatureByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const feature = await this.featureService.getFeatureByCode(RequestUtil.getParam(req.params.code));

            return res.status(200).json(ResponseUtil.success(FeatureMessages.FETCHED, feature));
        } catch (error) {
            next(error);
        }
    };

    getFeatures = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const features = await this.featureService.getFeatures({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                code: req.query.code as any,
                category: req.query.category as any,
                type: req.query.type as any,
                isDefault: req.query.isDefault !== undefined ? req.query.isDefault === "true" : undefined,
                isSystem: req.query.isSystem !== undefined ? req.query.isSystem === "true" : undefined,
                isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        FeatureMessages.FETCHED_ALL,
                        features.data,
                        features.pagination.page,
                        features.pagination.limit,
                        features.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const feature = await this.featureService.updateFeature(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(FeatureMessages.UPDATED, feature));
        } catch (error) {
            next(error);
        }
    };

    deleteFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.featureService.deleteFeature(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(FeatureMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changeFeatureStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const feature = await this.featureService.changeFeatureStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
            );

            return res.status(200).json(ResponseUtil.success(FeatureMessages.UPDATED, feature));
        } catch (error) {
            next(error);
        }
    };
}
