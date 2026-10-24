import type { ICountry, ICountryFilter } from "../interfaces/country.interface.js";
import { CountryRepository } from "../repositories/country.repository.js";
import { CountryMessages } from "../constants/country.messages.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";

export class CountryService {
    private countryRepository: CountryRepository;

    constructor() {
        this.countryRepository = new CountryRepository();
    }

    async createCountry(data: ICountry) {
        data.name = StringHelper.normalize(data.name);
        data.nativeName = StringHelper.normalize(data.nativeName);
        data.code = StringHelper.normalizeCountryCode(data.code) as ICountry["code"];
        data.alpha3Code = StringHelper.normalizeUpper(data.alpha3Code) as ICountry["alpha3Code"];
        data.numericCode = StringHelper.normalize(data.numericCode) as ICountry["numericCode"];
        data.dialCode = StringHelper.normalizeDialCode(data.dialCode) as ICountry["dialCode"];
        data.currencyCode = StringHelper.normalizeCurrencyCode(data.currencyCode) as ICountry["currencyCode"];
        data.currencySymbol = StringHelper.normalize(data.currencySymbol) as ICountry["currencyCode"];
        data.locale = StringHelper.normalizeLocale(data.locale);

        const conflicts = await this.countryRepository.findCreateConflicts(data);
        if (conflicts.some((country) => country.code === data.code)) {
            throw new AppError(CountryMessages.CODE_ALREADY_EXISTS, 409);
        }

        if (conflicts.some((country) => country.alpha3Code === data.alpha3Code)) {
            throw new AppError(CountryMessages.ALPHA3_CODE_ALREADY_EXISTS, 409);
        }

        if (conflicts.some((country) => country.numericCode === data.numericCode)) {
            throw new AppError(CountryMessages.NUMERIC_CODE_ALREADY_EXISTS, 409);
        }

        if (conflicts.some((country) => country.locale === data.locale)) {
            throw new AppError(CountryMessages.LOCALE_ALREADY_EXISTS, 409);
        }

        return this.countryRepository.create(data);
    }

    async getCountryById(id: string) {
        const country = await this.countryRepository.findById(id);

        if (!country) {
            throw new AppError(CountryMessages.NOT_FOUND, 404);
        }

        return country;
    }

    async getCountryByCode(code: string) {
        const country = await this.countryRepository.findByCode(StringHelper.normalizeCountryCode(code));
        if (!country) {
            throw new AppError(CountryMessages.NOT_FOUND, 404);
        }
        return country;
    }

    async getCountries(filters: ICountryFilter = {}) {
        return this.countryRepository.findAll(filters);
    }

    async updateCountry(id: string, data: Partial<ICountry>) {
        const country = await this.countryRepository.findById(id);
        if (!country) {
            throw new AppError(CountryMessages.NOT_FOUND, 404);
        }

        if (country.isSystem) {
            throw new AppError(CountryMessages.SYSTEM_COUNTRY_UPDATE, 403);
        }

        if (data.name) {
            data.name = StringHelper.normalize(data.name);
        }

        if (data.nativeName) {
            data.nativeName = StringHelper.normalize(data.nativeName);
        }

        if (data.code) {
            data.code = StringHelper.normalizeCountryCode(data.code) as ICountry["code"];

            const existingCountry = await this.countryRepository.findByCode(data.code);

            if (existingCountry && existingCountry._id.toString() !== id) {
                throw new AppError(CountryMessages.CODE_ALREADY_EXISTS, 409);
            }
        }

        if (data.alpha3Code) {
            data.alpha3Code = StringHelper.normalizeUpper(data.alpha3Code) as ICountry["alpha3Code"];
            const existingCountry = await this.countryRepository.findByAlpha3Code(data.alpha3Code);

            if (existingCountry && existingCountry._id.toString() !== id) {
                throw new AppError(CountryMessages.ALPHA3_CODE_ALREADY_EXISTS, 409);
            }
        }

        if (data.numericCode) {
            data.numericCode = StringHelper.normalize(data.numericCode) as ICountry["numericCode"];

            const existingCountry = await this.countryRepository.findByNumericCode(data.numericCode);

            if (existingCountry && existingCountry._id.toString() !== id) {
                throw new AppError(CountryMessages.NUMERIC_CODE_ALREADY_EXISTS, 409);
            }
        }

        if (data.dialCode) {
            data.dialCode = StringHelper.normalizeDialCode(data.dialCode) as ICountry["dialCode"];
        }

        if (data.currencyCode) {
            data.currencyCode = StringHelper.normalizeCurrencyCode(
                data.currencyCode,
            ) as ICountry["currencyCode"];
        }

        if (data.currencySymbol) {
            data.currencySymbol = StringHelper.normalize(data.currencySymbol);
        }

        if (data.locale) {
            data.locale = StringHelper.normalizeLocale(data.locale);

            const existingCountry = await this.countryRepository.findByLocale(data.locale);

            if (existingCountry && existingCountry._id.toString() !== id) {
                throw new AppError(CountryMessages.LOCALE_ALREADY_EXISTS, 409);
            }
        }

        return this.countryRepository.updateById(id, data);
    }

    async deleteCountry(id: string) {
        const country = await this.countryRepository.findById(id);

        if (!country) {
            throw new AppError(CountryMessages.NOT_FOUND, 404);
        }

        if (country.isSystem) {
            throw new AppError(CountryMessages.SYSTEM_COUNTRY_DELETE, 403);
        }

        if (country.isDefault) {
            throw new AppError(CountryMessages.DEFAULT_COUNTRY_DELETE, 403);
        }

        return this.countryRepository.deleteById(id);
    }

    async changeCountryStatus(id: string, isActive: boolean) {
        const country = await this.countryRepository.findById(id);

        if (!country) {
            throw new AppError(CountryMessages.NOT_FOUND, 404);
        }

        if (country.isSystem) {
            throw new AppError(CountryMessages.SYSTEM_COUNTRY_UPDATE, 403);
        }

        if (country.isDefault && !isActive) {
            throw new AppError(CountryMessages.CANNOT_DEACTIVATE_DEFAULT, 403);
        }

        return this.countryRepository.updateById(id, { isActive });
    }
}
