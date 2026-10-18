import type { Request, Response, NextFunction } from "express";
import { TimezoneService } from "../services/timezone.service.js";
import { TimezoneMessages } from "../constants/timezone.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class TimezoneController {
    private timezoneService: TimezoneService;

    constructor() {
        this.timezoneService = new TimezoneService();
    }

    createTimezone = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezone = await this.timezoneService.createTimezone(req.body);
            return res.status(201).json(ResponseUtil.created(TimezoneMessages.CREATED, timezone));
        } catch (error) {
            next(error);
        }
    };

    getTimezoneById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezone = await this.timezoneService.getTimezoneById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(TimezoneMessages.FETCHED, timezone));
        } catch (error) {
            next(error);
        }
    };

    getTimezoneByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezone = await this.timezoneService.getTimezoneByCode(req.query.code as string);
            return res.status(200).json(ResponseUtil.success(TimezoneMessages.FETCHED, timezone));
        } catch (error) {
            next(error);
        }
    };

    getTimezones = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezones = await this.timezoneService.getTimezones({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                code: req.query.code as string,
                countryCode: req.query.countryCode as any,
                utcOffset: req.query.utcOffset as string,
                isDefault: req.query.isDefault !== undefined ? req.query.isDefault === "true" : undefined,
                isSystem: req.query.isSystem !== undefined ? req.query.isSystem === "true" : undefined,
                isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        TimezoneMessages.FETCHED_ALL,
                        timezones.data,
                        timezones.pagination.page,
                        timezones.pagination.limit,
                        timezones.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    getTimezonesByCountry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezones = await this.timezoneService.getTimezonesByCountry(
                RequestUtil.getParam(req.params.countryCode),
            );

            return res.status(200).json(ResponseUtil.success(TimezoneMessages.FETCHED_BY_COUNTRY, timezones));
        } catch (error) {
            next(error);
        }
    };

    updateTimezone = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezone = await this.timezoneService.updateTimezone(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(TimezoneMessages.UPDATED, timezone));
        } catch (error) {
            next(error);
        }
    };

    deleteTimezone = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.timezoneService.deleteTimezone(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(TimezoneMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changeTimezoneStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const timezone = await this.timezoneService.changeTimezoneStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
            );

            return res.status(200).json(ResponseUtil.success(TimezoneMessages.UPDATED, timezone));
        } catch (error) {
            next(error);
        }
    };
}
