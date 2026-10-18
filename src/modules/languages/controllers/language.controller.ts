import type { Request, Response, NextFunction } from "express";

import { LanguageService } from "../services/language.service.js";

import { LanguageMessages } from "../constants/language.messages.js";

import { ResponseUtil } from "../../../utils/response.util.js";

import { RequestUtil } from "../../../utils/request.util.js";

export class LanguageController {
    private languageService: LanguageService;

    constructor() {
        this.languageService = new LanguageService();
    }

    createLanguage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const language = await this.languageService.createLanguage(req.body);

            return res.status(201).json(ResponseUtil.created(LanguageMessages.CREATED, language));
        } catch (error) {
            next(error);
        }
    };

    getLanguageById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const language = await this.languageService.getLanguageById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(LanguageMessages.FETCHED, language));
        } catch (error) {
            next(error);
        }
    };

    getLanguageByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const language = await this.languageService.getLanguageByCode(
                RequestUtil.getParam(req.params.code),
            );

            return res.status(200).json(ResponseUtil.success(LanguageMessages.FETCHED, language));
        } catch (error) {
            next(error);
        }
    };

    getLanguages = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const languages = await this.languageService.getLanguages({
                page: Number(req.query.page) || 1,

                limit: Number(req.query.limit) || 10,

                search: req.query.search as string,

                code: req.query.code as any,

                locale: req.query.locale as string,

                direction: req.query.direction as any,

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
                        LanguageMessages.FETCHED_ALL,
                        languages.data,
                        languages.pagination.page,
                        languages.pagination.limit,
                        languages.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateLanguage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const language = await this.languageService.updateLanguage(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(LanguageMessages.UPDATED, language));
        } catch (error) {
            next(error);
        }
    };

    deleteLanguage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.languageService.deleteLanguage(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(LanguageMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changeLanguageStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const language = await this.languageService.changeLanguageStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
            );

            return res.status(200).json(ResponseUtil.success(LanguageMessages.UPDATED, language));
        } catch (error) {
            next(error);
        }
    };
}
