import type { Request, Response, NextFunction } from "express";
import { SystemSettingService } from "../services/systemSetting.service.js";
import { SystemSettingMessages } from "../constants/systemSetting.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class SystemSettingController {
    private systemSettingService: SystemSettingService;

    constructor() {
        this.systemSettingService = new SystemSettingService();
    }

    createSystemSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const setting = await this.systemSettingService.createSystemSetting(req.body);

            return res.status(201).json(ResponseUtil.created(SystemSettingMessages.UPDATED, setting));
        } catch (error) {
            next(error);
        }
    };

    getSystemSettingById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const setting = await this.systemSettingService.getSystemSettingById(
                RequestUtil.getParam(req.params.id),
            );

            return res.status(200).json(ResponseUtil.success(SystemSettingMessages.FETCHED, setting));
        } catch (error) {
            next(error);
        }
    };

    getSystemSettingByKey = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const setting = await this.systemSettingService.getSystemSettingByKey(
                RequestUtil.getParam(req.params.key),
            );

            return res.status(200).json(ResponseUtil.success(SystemSettingMessages.FETCHED, setting));
        } catch (error) {
            next(error);
        }
    };

    getSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const settings = await this.systemSettingService.getSystemSettings({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                key: req.query.key as any,
                category: req.query.category as any,
                valueType: req.query.valueType as any,
                isEditable: req.query.isEditable !== undefined ? req.query.isEditable === "true" : undefined,
                isPublic: req.query.isPublic !== undefined ? req.query.isPublic === "true" : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        SystemSettingMessages.FETCHED_ALL,
                        settings.data,
                        settings.pagination.page,
                        settings.pagination.limit,
                        settings.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    getPublicSystemSettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const settings = await this.systemSettingService.getPublicSystemSettings();

            return res
                .status(200)
                .json(ResponseUtil.success(SystemSettingMessages.PUBLIC_SETTINGS_FETCHED, settings));
        } catch (error) {
            next(error);
        }
    };

    updateSystemSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const setting = await this.systemSettingService.updateSystemSetting(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as any,
            );

            return res.status(200).json(ResponseUtil.success(SystemSettingMessages.UPDATED, setting));
        } catch (error) {
            next(error);
        }
    };

    resetSystemSetting = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const setting = await this.systemSettingService.resetSystemSetting(
                RequestUtil.getParam(req.params.id),
                req.user?.id as any,
            );

            return res.status(200).json(ResponseUtil.success(SystemSettingMessages.RESET, setting));
        } catch (error) {
            next(error);
        }
    };
}
