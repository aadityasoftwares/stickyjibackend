import type { Request, Response, NextFunction, } from "express";
import { LocalizationService } from "../services/localization.service.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class LocalizationController {

    private localizationService: LocalizationService;

    constructor() {
        this.localizationService = new LocalizationService();
    }

    createLocalization = async (req: Request, res: Response, next: NextFunction) => {

        try {

            const localization = await this.localizationService.createLocalization(req.body);

            return res.status(201).json(
                ResponseUtil.created(
                    LocalizationMessages.CREATED,
                    localization
                )
            );

        } catch (error) {
            next(error);
        }
    };

    getLocalizationById = async (req: Request, res: Response, next: NextFunction) => {

        try {

            const localization = await this.localizationService.getLocalizationById(
                RequestUtil.getParam(
                    req.params.id
                )
            );

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.FETCHED,
                    localization
                )
            );

        } catch (error) {
            next(error);
        }
    };

    getLocalizationByKey = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {

        try {

            const localization = await this.localizationService.getLocalizationByKey(
                RequestUtil.getParam(
                    req.params.key
                ),
                RequestUtil.getParam(
                    req.params.locale
                )
            );

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.FETCHED,
                    localization
                )
            );

        } catch (error) {
            next(error);
        }
    };

    getLocalizations = async (req: Request, res: Response, next: NextFunction) => {

        try {

            const localizations = await this.localizationService.getLocalizations({

                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                language: req.query.language as any,
                languageCode: req.query.languageCode as string,
                locale: req.query.locale as string,
                module: req.query.module as string,
                isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
                isDefault: req.query.isDefault !== undefined ? req.query.isDefault === "true" : undefined,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as | "asc" | "desc",
            });

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.FETCHED_ALL,
                    localizations.data
                )
            );

        } catch (error) {
            next(error);
        }
    };

    updateLocalization = async (req: Request, res: Response, next: NextFunction) => {

        try {

            const localization =
                await this.localizationService.updateLocalization(
                    RequestUtil.getParam(
                        req.params.id
                    ),
                    req.body
                );

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.UPDATED,
                    localization
                )
            );

        } catch (error) {
            next(error);
        }
    };

    deleteLocalization = async (req: Request, res: Response, next: NextFunction) => {

        try {

            await this.localizationService.deleteLocalization(
                RequestUtil.getParam(
                    req.params.id
                )
            );

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.DELETED
                )
            );

        } catch (error) {
            next(error);
        }
    };

    changeLocalizationStatus = async (req: Request, res: Response, next: NextFunction) => {

        try {

            const localization =
                await this.localizationService.changeLocalizationStatus(
                    RequestUtil.getParam(
                        req.params.id
                    ),
                    req.body.isActive
                );

            return res.status(200).json(
                ResponseUtil.success(
                    LocalizationMessages.UPDATED,
                    localization
                )
            );

        } catch (error) {
            next(error);
        }
    };
}