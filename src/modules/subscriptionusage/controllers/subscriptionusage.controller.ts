import type { Request, Response, NextFunction } from "express";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { SubscriptionUsageMessages } from "../constants/subscriptionusage.messages.js";
import { SubscriptionUsageService } from "../services/subscriptionusage.service.js";
import { BillingScopeType } from "../constants/subscriptionusage.enums.js";

export class SubscriptionUsageController {
    constructor(
        private readonly usageService = new SubscriptionUsageService(),
    ) {}

    getMyUsage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = RequestUtil.getUserId(req);
            const fresh = Boolean(req.body?.fresh);
            const includeFolders = Boolean(req.body?.includeFolders);

            const result = await this.usageService.getMyUsage(userId, { fresh, includeFolders });
            return res.status(200).json(ResponseUtil.success(SubscriptionUsageMessages.FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    getSummary = async (req: Request, res: Response, next: NextFunction) => {
        return this.getMyUsage(req, res, next);
    };

    getWorkspaceUsage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const workspaceId = RequestUtil.getParam(req.params.workspaceId);
            const actorId = RequestUtil.getUserId(req);

            const result = await this.usageService.getWorkspaceFolderUsage(workspaceId, actorId);
            return res.status(200).json(ResponseUtil.success(SubscriptionUsageMessages.WORKSPACE_USAGE_FETCHED, result));
        } catch (error) {
            next(error);
        }
    };

    getAdminUsageList = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const actorId = RequestUtil.getUserId(req);
            const result = await this.usageService.getAdminUsageList(actorId, req.body);
            return res.status(200).json(ResponseUtil.paginated(
                SubscriptionUsageMessages.FETCHED_ALL,
                result.data,
                result.pagination.page,
                result.pagination.limit,
                result.pagination.total,
            ));
        } catch (error) {
            next(error);
        }
    };

    reconcileUsage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (req.body?.scopeId) {
                const scope = {
                    type: (req.body.scopeType as BillingScopeType) ?? BillingScopeType.USER,
                    id: req.body.scopeId as string,
                };
                const report = await this.usageService.reconcileUsage(scope, req.body.reason);
                return res.status(200).json(ResponseUtil.success(SubscriptionUsageMessages.RECONCILED, report));
            }

            const batchReport = await this.usageService.reconcileAll(req.body);
            return res.status(200).json(ResponseUtil.success(SubscriptionUsageMessages.RECONCILED, batchReport));
        } catch (error) {
            next(error);
        }
    };
}
