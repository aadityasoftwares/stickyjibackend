import type { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { UserSubscriptionMessages } from "../constants/usersubscription.messages.js";
import { UserSubscriptionService } from "../services/usersubscription.service.js";

export class UserSubscriptionController {
    private readonly subscriptionService: UserSubscriptionService;

    constructor() {
        this.subscriptionService = new UserSubscriptionService();
    }

    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: RequestUtil.getUserId(req),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    getCurrentSubscription = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getCurrentSubscription(RequestUtil.getUserId(req));
            return res.status(200).json(ResponseUtil.success(UserSubscriptionMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    getSubscriptionStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getSubscriptionStatus(RequestUtil.getUserId(req));
            return res.status(200).json(ResponseUtil.success(UserSubscriptionMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    getSubscriptionById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getSubscriptionById(
                RequestUtil.getParam(req.params.id),
                RequestUtil.getUserId(req),
            );
            return res.status(200).json(ResponseUtil.success(UserSubscriptionMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    getUserSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getUserSubscriptions(
                RequestUtil.getUserId(req),
                req.body,
            );
            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        UserSubscriptionMessages.FETCHED_ALL,
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

    getAdminSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getAdminSubscriptions(
                RequestUtil.getUserId(req),
                req.body,
            );
            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        UserSubscriptionMessages.FETCHED_ALL,
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

    getAdminSubscriptionById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.getAdminSubscriptionById(
                RequestUtil.getParam(req.params.id),
                RequestUtil.getUserId(req),
            );
            return res.status(200).json(ResponseUtil.success(UserSubscriptionMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    requestPlanChange = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.requestPlanChange(
                RequestUtil.getUserId(req),
                req.body,
                this.getAuditContext(req),
            );
            return res
                .status(200)
                .json(ResponseUtil.success(UserSubscriptionMessages.CHANGE_REQUESTED, result));
        } catch (error) {
            next(error);
        }
    };

    requestCancellation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.requestCancellation(
                RequestUtil.getUserId(req),
                req.body,
                this.getAuditContext(req),
            );
            return res
                .status(200)
                .json(ResponseUtil.success(UserSubscriptionMessages.CANCELLATION_REQUESTED, result));
        } catch (error) {
            next(error);
        }
    };

    undoScheduledCancellation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.undoScheduledCancellation(
                RequestUtil.getUserId(req),
                this.getAuditContext(req),
            );
            return res
                .status(200)
                .json(ResponseUtil.success(UserSubscriptionMessages.CANCELLATION_UNDONE, result));
        } catch (error) {
            next(error);
        }
    };

    reconcileSubscriptions = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.subscriptionService.reconcileAsAdmin(
                RequestUtil.getUserId(req),
                req.body,
                this.getAuditContext(req),
            );
            return res.status(200).json(ResponseUtil.success(UserSubscriptionMessages.RECONCILED, result));
        } catch (error) {
            next(error);
        }
    };
}
