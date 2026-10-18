import type { Request, Response, NextFunction } from "express";
import { PlanService } from "../services/plan.service.js";
import { PlanMessages } from "../constants/plan.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { PlanListFilters } from "../validations/planList.schema.js";

export class PlanController {
    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    private readonly planService: PlanService;

    constructor() {
        this.planService = new PlanService();
    }

    getSubscriptionPlans = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string | undefined;
            const catalog = await this.planService.getSubscriptionCatalog(userId);

            return res.status(200).json(ResponseUtil.success(PlanMessages.FETCHED_ALL, catalog));
        } catch (error) {
            next(error);
        }
    };

    createPlan = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plan = await this.planService.createPlan(
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
            );

            return res.status(201).json(ResponseUtil.created(PlanMessages.CREATED, plan));
        } catch (error) {
            next(error);
        }
    };

    getPlanById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plan = await this.planService.getPlanById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(PlanMessages.FETCHED, plan));
        } catch (error) {
            next(error);
        }
    };

    getPlanByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plan = await this.planService.getPlanByCode(RequestUtil.getParam(req.params.code));

            return res.status(200).json(ResponseUtil.success(PlanMessages.FETCHED, plan));
        } catch (error) {
            next(error);
        }
    };

    getPlans = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plans = await this.planService.getPlans(req.body as PlanListFilters);

            return res.status(200).json({
                ...ResponseUtil.success(PlanMessages.FETCHED_ALL, plans.data),
                meta: {
                    ...plans.pagination,
                    counts: plans.counts,
                    statusFilters: plans.statusFilters,
                },
            });
        } catch (error) {
            next(error);
        }
    };

    updatePlan = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plan = await this.planService.updatePlan(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as string,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PlanMessages.UPDATED, plan));
        } catch (error) {
            next(error);
        }
    };

    updatePlanStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const plan = await this.planService.updatePlanStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
                req.user?.id as string,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PlanMessages.STATUS_UPDATED, plan));
        } catch (error) {
            next(error);
        }
    };

    changePlanStatus = async (req: Request, res: Response, next: NextFunction) => {
        return this.updatePlanStatus(req, res, next);
    };

    deletePlan = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.planService.deletePlan(
                RequestUtil.getParam(req.params.id),
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(PlanMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };
}