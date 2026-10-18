import type { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { SubscriptionEntitlementService } from "../services/subscriptionentitlement.service.js";
import { SubscriptionEntitlementMessages } from "../constants/subscriptionentitlement.messages.js";

export class SubscriptionEntitlementController {
    constructor(
        private readonly service = new SubscriptionEntitlementService(),
    ) {}

    getMyEntitlements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = RequestUtil.getUserId(req);
            const data = await this.service.getMyEntitlements(userId, {
                fresh: req.body?.fresh,
            });
            res.status(200).json(
                ResponseUtil.success(SubscriptionEntitlementMessages.FETCHED_SUCCESSFULLY, data),
            );
        } catch (error) {
            next(error);
        }
    };

    getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        return this.getMyEntitlements(req, res, next);
    };

    checkResourceAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = RequestUtil.getUserId(req);
            const decision = await this.service.checkResourceAvailability(userId, req.body);
            res.status(200).json(
                ResponseUtil.success(SubscriptionEntitlementMessages.CHECK_SUCCESSFUL, decision),
            );
        } catch (error) {
            next(error);
        }
    };

    getWorkspaceFolderEntitlements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = RequestUtil.getUserId(req);
            const workspaceId = RequestUtil.getParam(req.params.workspaceId);
            const data = await this.service.getWorkspaceFolderEntitlements(userId, workspaceId);
            res.status(200).json(
                ResponseUtil.success(SubscriptionEntitlementMessages.FETCHED_SUCCESSFULLY, data),
            );
        } catch (error) {
            next(error);
        }
    };
}
