import type { Request, Response, NextFunction } from "express";

import { WorkspaceMemberInvitationService } from "../services/workspaceMemberInvitation.service.js";
import { WorkspaceMemberInvitationMessages } from "../constants/workspaceMemberInvitation.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class WorkspaceMemberInvitationController {
    private getAuditContext(req: Request) {
        const requestId = "requestId" in req && typeof req.requestId === "string" ? req.requestId : null;
        return {
            actorId: RequestUtil.getUserId(req),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }
    private readonly workspaceMemberInvitationService: WorkspaceMemberInvitationService;

    constructor() {
        this.workspaceMemberInvitationService = new WorkspaceMemberInvitationService();
    }

    createInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const isBatchRequest = Array.isArray(req.body?.invitations);

            const result = await this.workspaceMemberInvitationService.createInvitation(
                req.body,
                RequestUtil.getUserId(req),
                this.getAuditContext(req),
                res.locals.workspaceAuth,
            );

            if (!isBatchRequest) {
                return res
                    .status(201)
                    .json(ResponseUtil.created(WorkspaceMemberInvitationMessages.CREATED, result.invitations[0]));
            }

            const statusCode = result.summary.created > 0 ? 201 : 200;

            return res
                .status(statusCode)
                .json(ResponseUtil.success(WorkspaceMemberInvitationMessages.CREATED_BATCH, result));
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Public endpoint used before login / signup.
     *
     * The raw invitation token is the credential for this lookup.
     * Only safe invitation preview data is returned.
     */
    validateInvitationToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.setHeader("Cache-Control", "no-store");

            const preview = await this.workspaceMemberInvitationService.validateInvitationToken(req.body.token);

            return res.status(200).json(ResponseUtil.success(WorkspaceMemberInvitationMessages.VALIDATED, preview));
        } catch (error) {
            return next(error);
        }
    };

    /**
     * Authenticated endpoint.
     *
     * The frontend sends only the raw invitation token.
     * Workspace, role, invited email and member identity are resolved and
     * verified by the service.
     */
    acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.setHeader("Cache-Control", "no-store");

            const result = await this.workspaceMemberInvitationService.acceptInvitation(
                req.body.token,
                RequestUtil.getUserId(req),
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMemberInvitationMessages.ACCEPTED, result));
        } catch (error) {
            return next(error);
        }
    };

    getInvitationById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invitation = await this.workspaceMemberInvitationService.getInvitationById(
                RequestUtil.getParam(req.params.id),
                RequestUtil.getUserId(req),
                res.locals.workspaceAuth,
                res.locals.invitationResponse,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMemberInvitationMessages.FETCHED, invitation));
        } catch (error) {
            return next(error);
        }
    };

    getInvitations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invitations = await this.workspaceMemberInvitationService.getInvitations(
                req.body,
                RequestUtil.getUserId(req),
                res.locals.workspaceAuth,
            );

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        WorkspaceMemberInvitationMessages.FETCHED_ALL,
                        invitations.data,
                        invitations.pagination.page,
                        invitations.pagination.limit,
                        invitations.pagination.total,
                    ),
                );
        } catch (error) {
            return next(error);
        }
    };

    updateInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invitation = await this.workspaceMemberInvitationService.updateInvitation(
                RequestUtil.getParam(req.params.id),
                req.body,
                RequestUtil.getUserId(req),
                this.getAuditContext(req),
                res.locals.workspaceAuth,
                res.locals.targetInvitation,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMemberInvitationMessages.UPDATED, invitation));
        } catch (error) {
            return next(error);
        }
    };

    cancelInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const invitation = await this.workspaceMemberInvitationService.cancelInvitation(
                RequestUtil.getParam(req.params.id),
                RequestUtil.getUserId(req),
                this.getAuditContext(req),
                res.locals.workspaceAuth,
                res.locals.targetInvitation,
            );

            return res.status(200).json(ResponseUtil.success(WorkspaceMemberInvitationMessages.CANCELLED, invitation));
        } catch (error) {
            return next(error);
        }
    };
}
