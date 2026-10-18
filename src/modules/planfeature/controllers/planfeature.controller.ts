import type { Request, Response, NextFunction } from "express";
import { PlanFeatureService } from "../services/planfeature.service.js";
import { PlanFeatureMessages } from "../constants/planFeature.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class PlanFeatureController {
    private planFeatureService: PlanFeatureService;

    constructor() {
        this.planFeatureService = new PlanFeatureService();
    }

    createPlanFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeature = await this.planFeatureService.createPlanFeature(req.body);
            return res.status(201).json(ResponseUtil.created(PlanFeatureMessages.CREATED, planFeature));
        } catch (error) {
            next(error);
        }
    };

    getPlanFeatureById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeature = await this.planFeatureService.getPlanFeatureById(
                RequestUtil.getParam(req.params.id),
            );

            return res.status(200).json(ResponseUtil.success(PlanFeatureMessages.FETCHED, planFeature));
        } catch (error) {
            next(error);
        }
    };

    getPlanFeatureByPlanAndFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeature = await this.planFeatureService.getPlanFeatureByPlanAndFeature(
                RequestUtil.getParam(req.params.planId),
                RequestUtil.getParam(req.params.featureId),
            );

            return res.status(200).json(ResponseUtil.success(PlanFeatureMessages.FETCHED, planFeature));
        } catch (error) {
            next(error);
        }
    };

    getPlanFeatures = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeatures = await this.planFeatureService.getPlanFeatures({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                planId: req.query.planId as string,
                featureId: req.query.featureId as string,
                isEnabled: req.query.isEnabled !== undefined ? req.query.isEnabled === "true" : undefined,
                limitType: req.query.limitType as any,
                isUnlimited:
                    req.query.isUnlimited !== undefined ? req.query.isUnlimited === "true" : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });
            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        PlanFeatureMessages.FETCHED_ALL,
                        planFeatures.data,
                        planFeatures.pagination.page,
                        planFeatures.pagination.limit,
                        planFeatures.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updatePlanFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeature = await this.planFeatureService.updatePlanFeature(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(PlanFeatureMessages.UPDATED, planFeature));
        } catch (error) {
            next(error);
        }
    };

    deletePlanFeature = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.planFeatureService.deletePlanFeature(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(PlanFeatureMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changePlanFeatureStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const planFeature = await this.planFeatureService.changePlanFeatureStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isEnabled,
            );

            return res.status(200).json(ResponseUtil.success(PlanFeatureMessages.UPDATED, planFeature));
        } catch (error) {
            next(error);
        }
    };
}
