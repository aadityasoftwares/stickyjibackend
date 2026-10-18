import type { Request, Response, NextFunction } from "express";

import { PlanPriceService } from "../services/planPrice.service.js";

import { PlanPriceMessages } from "../constants/planPrice.messages.js";

import { RequestUtil } from "../../../utils/request.util.js";

import type { IPlanPriceFilter } from "../interfaces/planPrice.interface.js";

export class PlanPriceController {
    private planPriceService: PlanPriceService;

    constructor() {
        this.planPriceService = new PlanPriceService();
    }

    createPlanPrice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.planPriceService.createPlanPrice(req.body, this.getAuditContext(req));

            return res.status(201).json({
                success: true,

                message: PlanPriceMessages.CREATED,

                data,
            });
        } catch (error) {
            next(error);
        }
    };

    getPlanPriceById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.planPriceService.getPlanPriceById(RequestUtil.getParam(req.params.id));

            return res.status(200).json({
                success: true,

                message: PlanPriceMessages.FETCHED,

                data,
            });
        } catch (error) {
            next(error);
        }
    };

    getPlanPrices = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const filters: IPlanPriceFilter = {
                planId: req.query.planId?.toString(),

                currencyId: req.query.currencyId?.toString(),

                billingInterval: req.query.billingInterval as any,

                isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true",

                page: req.query.page ? Number(req.query.page) : 1,

                limit: req.query.limit ? Number(req.query.limit) : 10,

                sortBy: req.query.sortBy?.toString(),

                sortOrder:
                    req.query.sortOrder === "asc"
                        ? "asc"
                        : req.query.sortOrder === "desc"
                          ? "desc"
                          : undefined,
            };

            const data = await this.planPriceService.getPlanPrices(filters);

            return res.status(200).json({
                success: true,

                message: PlanPriceMessages.LIST_FETCHED,

                ...data,
            });
        } catch (error) {
            next(error);
        }
    };

    updatePlanPrice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.planPriceService.updatePlanPrice(
                RequestUtil.getParam(req.params.id),

                req.body,

                this.getAuditContext(req),
            );

            return res.status(200).json({
                success: true,

                message: PlanPriceMessages.UPDATED,

                data,
            });
        } catch (error) {
            next(error);
        }
    };

    changePlanPriceStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.planPriceService.changePlanPriceStatus(
                RequestUtil.getParam(req.params.id),

                req.body.isActive,

                this.getAuditContext(req),
            );

            return res.status(200).json({
                success: true,

                message: PlanPriceMessages.STATUS_CHANGED,

                data,
            });
        } catch (error) {
            next(error);
        }
    };

    deletePlanPrice = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.planPriceService.deletePlanPrice(
                RequestUtil.getParam(req.params.id),

                this.getAuditContext(req),
            );

            return res.status(200).json({
                success: true,

                message: PlanPriceMessages.DELETED,

                data,
            });
        } catch (error) {
            next(error);
        }
    };

    private getAuditContext(req: Request) {
        return {
            actorId: req.user?.id ?? null,

            ipAddress: req.ip ?? null,

            userAgent: req.get("user-agent") ?? null,
        };
    }
}
