import type { Request, Response, NextFunction } from "express";
import { UserWorkspaceProvisioningService } from "../../workspace/services/userWorkspaceProvisioning.service.js";
import { ResponseUtil } from "../../../utils/response.util.js";

export class OnboardingController {
    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }
    private readonly userWorkspaceProvisioningService: UserWorkspaceProvisioningService;

    constructor() {
        this.userWorkspaceProvisioningService = new UserWorkspaceProvisioningService();
    }

    getOnboardingStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const status = await this.userWorkspaceProvisioningService.getOnboardingStatus(req.user?.id as string);
            return res.status(200).json(ResponseUtil.success("Onboarding status retrieved successfully.", status));
        } catch (error) {
            next(error);
        }
    };

    initialSetup = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.userWorkspaceProvisioningService.initialSetup(
                req.user?.id as string,
                req.body,
                this.getAuditContext(req),
            );

            return res
                .status(201)
                .json(ResponseUtil.created("Initial onboarding setup completed successfully.", result));
        } catch (error) {
            next(error);
        }
    };
}

