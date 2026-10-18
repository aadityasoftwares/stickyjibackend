import type { ITimezone, ITimezoneFilter } from "../interfaces/timezone.interface.js";
import { TimezoneRepository } from "../repositories/timezone.repository.js";
import { TimezoneMessages } from "../constants/timezone.messages.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { isValidTimezone, isTimezoneAvailableForCountry } from "../constants/timezone.constants.js";
import { CountryCode } from "../../countries/constants/country.enums.js";

export class TimezoneService {
    private timezoneRepository: TimezoneRepository;

    constructor() {
        this.timezoneRepository = new TimezoneRepository();
    }

    async createTimezone(data: ITimezone) {
        data.name = StringHelper.normalize(data.name);
        data.code = StringHelper.normalize(data.code);
        data.countryCode = data.countryCode;
        data.utcOffset = StringHelper.normalize(data.utcOffset);
        if (!isValidTimezone(data.code)) {
            throw new AppError(TimezoneMessages.INVALID_CODE, 400);
        }

        if (!Object.values(CountryCode).includes(data.countryCode)) {
            throw new AppError(TimezoneMessages.INVALID_COUNTRY_CODE, 400);
        }

        if (!isTimezoneAvailableForCountry(data.countryCode, data.code)) {
            throw new AppError(TimezoneMessages.TIMEZONE_NOT_AVAILABLE_FOR_COUNTRY, 400);
        }

        const codeExists = await this.timezoneRepository.existsByCode(data.code);

        if (codeExists) {
            throw new AppError(TimezoneMessages.ALREADY_EXISTS, 409);
        }

        return this.timezoneRepository.create(data);
    }

    async getTimezoneById(id: string) {
        const timezone = await this.timezoneRepository.findById(id);
        if (!timezone) {
            throw new AppError(TimezoneMessages.NOT_FOUND, 404);
        }
        return timezone;
    }

    async getTimezoneByCode(code: string) {
        const timezone = await this.timezoneRepository.findByCode(code);
        if (!timezone) {
            throw new AppError(TimezoneMessages.NOT_FOUND, 404);
        }
        return timezone;
    }

    async getTimezones(filters: ITimezoneFilter = {}) {
        return this.timezoneRepository.findAll(filters);
    }

    async getTimezonesByCountry(countryCode: string) {
        const normalizedCountryCode = countryCode.toUpperCase().trim();

        if (!Object.values(CountryCode).includes(normalizedCountryCode as CountryCode)) {
            throw new AppError(TimezoneMessages.INVALID_COUNTRY_CODE, 400);
        }

        const timezones = await this.timezoneRepository.findByCountryCode(normalizedCountryCode);

        if (!timezones.length) {
            throw new AppError(TimezoneMessages.COUNTRY_TIMEZONES_NOT_FOUND, 404);
        }
        return timezones;
    }

    async updateTimezone(id: string, data: Partial<ITimezone>) {
        const timezone = await this.timezoneRepository.findById(id);

        if (!timezone) {
            throw new AppError(TimezoneMessages.NOT_FOUND, 404);
        }

        if (timezone.isSystem) {
            throw new AppError(TimezoneMessages.SYSTEM_TIMEZONE_UPDATE, 403);
        }

        if (data.name) {
            data.name = StringHelper.normalize(data.name);
        }

        if (data.code) {
            data.code = StringHelper.normalize(data.code);

            if (!isValidTimezone(data.code)) {
                throw new AppError(TimezoneMessages.INVALID_CODE, 400);
            }

            const countryCode = data.countryCode ?? timezone.countryCode;

            if (!isTimezoneAvailableForCountry(countryCode, data.code)) {
                throw new AppError(TimezoneMessages.TIMEZONE_NOT_AVAILABLE_FOR_COUNTRY, 400);
            }

            const existingTimezone = await this.timezoneRepository.findByCode(data.code);

            if (existingTimezone && existingTimezone._id.toString() !== id) {
                throw new AppError(TimezoneMessages.ALREADY_EXISTS, 409);
            }
        }

        if (data.countryCode) {
            const countryCode = data.countryCode;

            if (!Object.values(CountryCode).includes(countryCode)) {
                throw new AppError(TimezoneMessages.INVALID_COUNTRY_CODE, 400);
            }

            const timezoneCode = data.code ?? timezone.code;

            if (!isTimezoneAvailableForCountry(countryCode, timezoneCode)) {
                throw new AppError(TimezoneMessages.TIMEZONE_NOT_AVAILABLE_FOR_COUNTRY, 400);
            }
        }

        if (data.utcOffset) {
            data.utcOffset = StringHelper.normalize(data.utcOffset);
        }

        return this.timezoneRepository.updateById(id, data);
    }

    async deleteTimezone(id: string) {
        const timezone = await this.timezoneRepository.findById(id);

        if (!timezone) {
            throw new AppError(TimezoneMessages.NOT_FOUND, 404);
        }

        if (timezone.isSystem) {
            throw new AppError(TimezoneMessages.SYSTEM_TIMEZONE_DELETE, 403);
        }

        if (timezone.isDefault) {
            throw new AppError(TimezoneMessages.DEFAULT_TIMEZONE_DELETE, 403);
        }

        return this.timezoneRepository.deleteById(id);
    }

    async changeTimezoneStatus(id: string, isActive: boolean) {
        const timezone = await this.timezoneRepository.findById(id);

        if (!timezone) {
            throw new AppError(TimezoneMessages.NOT_FOUND, 404);
        }

        if (timezone.isSystem) {
            throw new AppError(TimezoneMessages.SYSTEM_TIMEZONE_UPDATE, 403);
        }

        if (timezone.isDefault && !isActive) {
            throw new AppError(TimezoneMessages.CANNOT_DEACTIVATE_DEFAULT, 403);
        }

        return this.timezoneRepository.updateById(id, { isActive });
    }
}
