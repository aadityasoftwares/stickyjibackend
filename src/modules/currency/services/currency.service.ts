import type { ICurrency, ICurrencyFilter, } from "../interfaces/currency.interface.js";
import { CurrencyRepository, } from "../repositories/currency.repository.js";
import { CurrencyMessages, } from "../constants/currency.messages.js";
import { StringHelper, } from "../../../utils/helpers/string.helper.js";
import { AppError, } from "../../../utils/errors/app.error.js";
import { CurrencyCode, CurrencyType, } from "../constants/currency.enums.js";
import { CURRENCY_SYMBOL_MAP, getCurrencyDecimalPlaces, } from "../constants/currency.constants.js";

export class CurrencyService {

    private currencyRepository: CurrencyRepository;

    constructor() {
        this.currencyRepository = new CurrencyRepository();
    }

    async createCurrency(data: ICurrency) {
        data.name = StringHelper.normalize(data.name);
        data.code = data.code;
        data.symbol = StringHelper.normalize(data.symbol);
        data.numericCode = StringHelper.normalize(data.numericCode);

        if (!Object.values(CurrencyCode).includes(data.code)) {
            throw new AppError(
                CurrencyMessages.INVALID_CODE,
                400
            );
        }

        if (!Object.values(CurrencyType).includes(data.type)) {
            throw new AppError(
                CurrencyMessages.INVALID_TYPE,
                400
            );
        }

        const codeExists = await this.currencyRepository.existsByCode(data.code);

        if (codeExists) {
            throw new AppError(
                CurrencyMessages.ALREADY_EXISTS,
                409
            );
        }

        const numericCodeExists = await this.currencyRepository.existsByNumericCode(data.numericCode);

        if (numericCodeExists) {
            throw new AppError(
                CurrencyMessages.NUMERIC_CODE_ALREADY_EXISTS,
                409
            );
        }

        return this.currencyRepository.create(data);
    }


    async getCurrencyById(id: string) {

        const currency = await this.currencyRepository.findById(id);
        console.log(currency)
        if (!currency) {
            throw new AppError(
                CurrencyMessages.NOT_FOUND,
                404
            );
        }

        return currency;
    }


    async getCurrencyByCode(code: string) {

        const currency = await this.currencyRepository.findByCode(code);

        if (!currency) {
            throw new AppError(
                CurrencyMessages.NOT_FOUND,
                404
            );
        }

        return currency;
    }


    async getCurrencies(filters: ICurrencyFilter = {}) {
        return this.currencyRepository.findAll(filters);
    }


    async updateCurrency(id: string, data: Partial<ICurrency>) {

        const currency = await this.currencyRepository.findById(id);
        console.log(currency);

        if (!currency) {
            throw new AppError(
                CurrencyMessages.NOT_FOUND,
                404
            );
        }

        if (currency.isSystem) {
            throw new AppError(
                CurrencyMessages.SYSTEM_CURRENCY_UPDATE,
                403
            );
        }

        if (data.name) {
            data.name = StringHelper.normalize(data.name);
        }

        if (data.symbol) {
            data.symbol = StringHelper.normalize(data.symbol);
        }

        if (data.numericCode) {
            data.numericCode = StringHelper.normalize(data.numericCode);

            const existingCurrency = await this.currencyRepository.findByNumericCode(data.numericCode);

            if (existingCurrency && existingCurrency._id.toString() !== id) {
                throw new AppError(
                    CurrencyMessages.NUMERIC_CODE_ALREADY_EXISTS,
                    409
                );
            }
        }


        if (data.code) {

            const existingCurrency = await this.currencyRepository.findByCode(data.code);

            if (existingCurrency && existingCurrency._id.toString() !== id) {

                throw new AppError(
                    CurrencyMessages.ALREADY_EXISTS,
                    409
                );

            }

            if (!Object.values(CurrencyCode).includes(data.code)) {
                throw new AppError(
                    CurrencyMessages.INVALID_CODE,
                    400
                );
            }
        }


        if (data.type) {
            if (!Object.values(CurrencyType).includes(data.type)) {
                throw new AppError(
                    CurrencyMessages.INVALID_TYPE,
                    400
                );
            }
        }

        return this.currencyRepository.updateById(id, data);
    }

    async deleteCurrency(id: string) {

        const currency = await this.currencyRepository.findById(id);

        if (!currency) {
            throw new AppError(
                CurrencyMessages.NOT_FOUND,
                404
            );
        }

        if (currency.isSystem) {
            throw new AppError(
                CurrencyMessages.SYSTEM_CURRENCY_DELETE,
                403
            );
        }

        if (currency.isDefault) {
            throw new AppError(
                CurrencyMessages.DEFAULT_CURRENCY_DELETE,
                403
            );
        }

        return this.currencyRepository.deleteById(id);
    }

    async changeCurrencyStatus(id: string, isActive: boolean) {

        const currency = await this.currencyRepository.findById(id);

        if (!currency) {
            throw new AppError(
                CurrencyMessages.NOT_FOUND,
                404
            );
        }

        if (currency.isSystem) {
            throw new AppError(
                CurrencyMessages.SYSTEM_CURRENCY_UPDATE,
                403
            );
        }

        if (currency.isDefault && !isActive) {
            throw new AppError(
                CurrencyMessages.CANNOT_DEACTIVATE_DEFAULT,
                403
            );
        }

        return this.currencyRepository.updateById(id, { isActive, });
    }
}