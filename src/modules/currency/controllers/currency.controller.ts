import type { Request, Response, NextFunction } from "express";
import { CurrencyService } from "../services/currency.service.js";
import { CurrencyMessages } from "../constants/currency.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class CurrencyController {
    private currencyService: CurrencyService;

    constructor() {
        this.currencyService = new CurrencyService();
    }

    createCurrency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currency = await this.currencyService.createCurrency(req.body);
            return res.status(201).json(ResponseUtil.created(CurrencyMessages.CREATED, currency));
        } catch (error) {
            next(error);
        }
    };

    getCurrencyById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currency = await this.currencyService.getCurrencyById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(CurrencyMessages.FETCHED, currency));
        } catch (error) {
            next(error);
        }
    };

    getCurrencyByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currency = await this.currencyService.getCurrencyByCode(
                RequestUtil.getParam(req.params.code),
            );

            return res.status(200).json(ResponseUtil.success(CurrencyMessages.FETCHED, currency));
        } catch (error) {
            next(error);
        }
    };

    getCurrencies = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currencies = await this.currencyService.getCurrencies({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                code: req.query.code as any,
                numericCode: req.query.numericCode as string,
                type: req.query.type as any,
                decimalPlaces:
                    req.query.decimalPlaces !== undefined ? Number(req.query.decimalPlaces) : undefined,
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
                        CurrencyMessages.FETCHED_ALL,
                        currencies.data,
                        currencies.pagination.page,
                        currencies.pagination.limit,
                        currencies.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateCurrency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currency = await this.currencyService.updateCurrency(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(CurrencyMessages.UPDATED, currency));
        } catch (error) {
            next(error);
        }
    };

    deleteCurrency = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.currencyService.deleteCurrency(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(CurrencyMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changeCurrencyStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currency = await this.currencyService.changeCurrencyStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
            );

            return res.status(200).json(ResponseUtil.success(CurrencyMessages.UPDATED, currency));
        } catch (error) {
            next(error);
        }
    };
}
