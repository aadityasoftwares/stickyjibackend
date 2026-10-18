import type { Request, Response, NextFunction } from "express";
import { CountryService } from "../services/country.service.js";
import { CountryMessages } from "../constants/country.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class CountryController {
    private countryService: CountryService;

    constructor() {
        this.countryService = new CountryService();
    }

    createCountry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const country = await this.countryService.createCountry(req.body);
            return res.status(201).json(ResponseUtil.created(CountryMessages.CREATED, country));
        } catch (error) {
            next(error);
        }
    };

    getCountryById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const country = await this.countryService.getCountryById(RequestUtil.getParam(req.params.id));
            return res.status(200).json(ResponseUtil.success(CountryMessages.FETCHED, country));
        } catch (error) {
            next(error);
        }
    };

    getCountryByCode = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const country = await this.countryService.getCountryByCode(RequestUtil.getParam(req.params.code));

            return res.status(200).json(ResponseUtil.success(CountryMessages.FETCHED, country));
        } catch (error) {
            next(error);
        }
    };

    getCountries = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const countries = await this.countryService.getCountries({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                code: req.query.code as any,
                alpha3Code: req.query.alpha3Code as any,
                numericCode: req.query.numericCode as any,
                dialCode: req.query.dialCode as any,
                continent: req.query.continent as any,
                currencyCode: req.query.currencyCode as any,
                locale: req.query.locale as string,
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
                        CountryMessages.FETCHED_ALL,
                        countries.data,
                        countries.pagination.page,
                        countries.pagination.limit,
                        countries.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateCountry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const country = await this.countryService.updateCountry(
                RequestUtil.getParam(req.params.id),
                req.body,
            );

            return res.status(200).json(ResponseUtil.success(CountryMessages.UPDATED, country));
        } catch (error) {
            next(error);
        }
    };

    deleteCountry = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.countryService.deleteCountry(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(CountryMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    changeCountryStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const country = await this.countryService.changeCountryStatus(
                RequestUtil.getParam(req.params.id),
                req.body.isActive,
            );

            return res.status(200).json(ResponseUtil.success(CountryMessages.UPDATED, country));
        } catch (error) {
            next(error);
        }
    };
}
