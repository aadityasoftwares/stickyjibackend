import type { ILocalization, ILocalizationFilter } from "../interfaces/localization.interface.js";
import { LocalizationRepository } from "../repositories/localization.repository.js";
import { LocalizationMessages } from "../constants/localization.messages.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";

export class LocalizationService {
    private localizationRepository: LocalizationRepository;

    constructor() {
        this.localizationRepository = new LocalizationRepository();
    }

    async createLocalization(data: ILocalization) {
        data.language = data.language;

        data.languageCode = StringHelper.normalize(data.languageCode).toLowerCase();

        data.locale = StringHelper.normalize(data.locale);

        data.key = StringHelper.normalize(data.key);

        data.value = StringHelper.normalize(data.value);

        data.module = StringHelper.normalizeUpper(data.module);

        data.description = StringHelper.normalizeOptional(data.description);

        const exists = await this.localizationRepository.existsByKey(data.key, data.locale);

        if (exists) {
            throw new AppError(LocalizationMessages.ALREADY_EXISTS, 409);
        }

        return this.localizationRepository.create(data);
    }

    async getLocalizationById(id: string) {
        const localization = await this.localizationRepository.findById(id);

        if (!localization) {
            throw new AppError(LocalizationMessages.NOT_FOUND, 404);
        }

        return localization;
    }

    async getLocalizationByKey(key: string, locale: string) {
        const localization = await this.localizationRepository.findByKey(
            StringHelper.normalize(key),
            StringHelper.normalize(locale),
        );

        if (!localization) {
            throw new AppError(LocalizationMessages.NOT_FOUND, 404);
        }

        return localization;
    }

    async getLocalizations(filters: ILocalizationFilter = {}) {
        return this.localizationRepository.findAll(filters);
    }

    async updateLocalization(id: string, data: Partial<ILocalization>) {
        const localization = await this.localizationRepository.findById(id);

        if (!localization) {
            throw new AppError(LocalizationMessages.NOT_FOUND, 404);
        }

        if (data.languageCode) {
            data.languageCode = StringHelper.normalize(data.languageCode).toLowerCase();
        }

        if (data.locale) {
            data.locale = StringHelper.normalize(data.locale);
        }

        if (data.key) {
            data.key = StringHelper.normalize(data.key);
        }

        if (data.value) {
            data.value = StringHelper.normalize(data.value);
        }

        if (data.module) {
            data.module = StringHelper.normalizeUpper(data.module);
        }

        if (data.description !== undefined) {
            data.description = StringHelper.normalizeOptional(data.description);
        }

        if (data.key || data.locale) {
            const key = data.key ?? localization.key;

            const locale = data.locale ?? localization.locale;

            const existingLocalization = await this.localizationRepository.findByKey(key, locale);

            if (existingLocalization && existingLocalization._id.toString() !== id) {
                throw new AppError(LocalizationMessages.ALREADY_EXISTS, 409);
            }
        }

        return this.localizationRepository.updateById(id, data);
    }

    async deleteLocalization(id: string) {
        const localization = await this.localizationRepository.findById(id);

        if (!localization) {
            throw new AppError(LocalizationMessages.NOT_FOUND, 404);
        }

        return this.localizationRepository.deleteById(id);
    }

    async changeLocalizationStatus(id: string, isActive: boolean) {
        const localization = await this.localizationRepository.findById(id);

        if (!localization) {
            throw new AppError(LocalizationMessages.NOT_FOUND, 404);
        }

        return this.localizationRepository.updateById(id, { isActive });
    }
}
