import type { Request, Response, NextFunction } from "express";
import { UserPreferenceService } from "../services/userPreference.service.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";
import type { IUserPreferenceFilter } from "../interfaces/userPreference.interface.js";
import { UserPreferenceCategory, UserPreferenceValueType } from "../constants/userPreference.enums.js";

export class UserPreferenceController {
    private userPreferenceService: UserPreferenceService;

    constructor() {
        this.userPreferenceService = new UserPreferenceService();
    }

    private getAuditContext(req: Request) {
        return {
            actorId: req.user?.id ?? null,
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
            requestId: (req as any).requestId ?? null,
        };
    }

    createUserPreference = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const preference = await this.userPreferenceService.createUserPreference(
                userId,
                req.body,
                this.getAuditContext(req),
            );

            return res.status(201).json(ResponseUtil.created(UserPreferenceMessages.CREATED, preference));
        } catch (error) {
            next(error);
        }
    };

    getUserPreference = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const key = RequestUtil.getParam(req.params.key);
            const preference = await this.userPreferenceService.getUserPreference(userId, key);

            return res.status(200).json(ResponseUtil.success(UserPreferenceMessages.FETCHED, preference));
        } catch (error) {
            next(error);
        }
    };

    getUserPreferences = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const filters: IUserPreferenceFilter = {
                key: req.query.key as string | undefined,
                category: req.query.category as UserPreferenceCategory | undefined,
                valueType: req.query.valueType as UserPreferenceValueType | undefined,
            };

            const preferences = await this.userPreferenceService.getUserPreferences(userId, filters);

            return res
                .status(200)
                .json(ResponseUtil.success(UserPreferenceMessages.FETCHED_ALL, preferences));
        } catch (error) {
            next(error);
        }
    };

    updateUserPreference = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const { key, value } = req.body;

            const preference = await this.userPreferenceService.updateUserPreference(
                userId,
                key,
                { value },
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(UserPreferenceMessages.UPDATED, preference));
        } catch (error) {
            next(error);
        }
    };

    deleteUserPreference = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const key = RequestUtil.getParam(req.params.key);

            await this.userPreferenceService.deleteUserPreference(userId, key, this.getAuditContext(req));

            return res.status(200).json(ResponseUtil.success(UserPreferenceMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    resetUserPreference = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;
            const { key } = req.body;

            const preference = await this.userPreferenceService.resetUserPreference(
                userId,
                key,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(UserPreferenceMessages.RESET, preference));
        } catch (error) {
            next(error);
        }
    };

    resetAllUserPreferences = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id as string;

            const preferences = await this.userPreferenceService.resetAllUserPreferences(
                userId,
                this.getAuditContext(req),
            );

            return res.status(200).json(ResponseUtil.success(UserPreferenceMessages.RESET_ALL, preferences));
        } catch (error) {
            next(error);
        }
    };
}
