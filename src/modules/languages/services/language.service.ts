import type { ILanguage, ILanguageFilter, } from "../interfaces/language.interface.js";
import { LanguageRepository, } from "../repositories/language.repository.js";
import { LanguageMessages, } from "../constants/language.messages.js";
import { StringHelper, } from "../../../utils/helpers/string.helper.js";
import { AppError, } from "../../../utils/errors/app.error.js";

export class LanguageService {

    private languageRepository: LanguageRepository;

    constructor() {
        this.languageRepository = new LanguageRepository();
    }

    async createLanguage(data: ILanguage) {

        data.name = StringHelper.normalize(data.name);
        data.nativeName = StringHelper.normalize(data.nativeName);
        data.code = data.code;
        data.locale = StringHelper.normalize(data.locale);

        const codeExists = await this.languageRepository.existsByCode(data.code);

        if (codeExists) {
            throw new AppError(
                LanguageMessages.ALREADY_EXISTS,
                409
            );
        }

        const localeExists = await this.languageRepository.existsByLocale(data.locale);

        if (localeExists) {
            throw new AppError(
                LanguageMessages.ALREADY_EXISTS,
                409
            );
        }

        return this.languageRepository.create(data);
    }

    async getLanguageById(id: string) {

        const language = await this.languageRepository.findById(id);

        if (!language) {
            throw new AppError(
                LanguageMessages.NOT_FOUND,
                404
            );
        }

        return language;
    }

    async getLanguageByCode(code: string) {

        const language = await this.languageRepository.findByCode(code);

        if (!language) {
            throw new AppError(
                LanguageMessages.NOT_FOUND,
                404
            );
        }

        return language;
    }

    async getLanguages(filters: ILanguageFilter = {}) {

        return this.languageRepository.findAll(filters);
    }

    async updateLanguage(id: string, data: Partial<ILanguage>) {

        const language = await this.languageRepository.findById(id);

        if (!language) {
            throw new AppError(
                LanguageMessages.NOT_FOUND,
                404
            );
        }

        if (language.isSystem) {
            throw new AppError(
                LanguageMessages.SYSTEM_LANGUAGE_UPDATE,
                403
            );
        }

        if (data.name) {
            data.name = StringHelper.normalize(data.name);
        }

        if (data.nativeName) {
            data.nativeName = StringHelper.normalize(data.nativeName);
        }

        if (data.locale) {
            data.locale = StringHelper.normalize(data.locale);

            const existingLanguage = await this.languageRepository.findByLocale(data.locale);

            if (existingLanguage && existingLanguage._id.toString() !== id) {
                throw new AppError(
                    LanguageMessages.ALREADY_EXISTS,
                    409
                );
            }
        }

        if (data.code) {

            const existingLanguage = await this.languageRepository.findByCode(data.code);

            if (existingLanguage && existingLanguage._id.toString() !== id) {
                throw new AppError(
                    LanguageMessages.ALREADY_EXISTS,
                    409
                );
            }
        }

        return this.languageRepository.updateById(id, data);
    }

    async deleteLanguage(id: string) {

        const language = await this.languageRepository.findById(id);

        if (!language) {
            throw new AppError(
                LanguageMessages.NOT_FOUND,
                404
            );
        }

        if (language.isSystem) {
            throw new AppError(
                LanguageMessages.SYSTEM_LANGUAGE_DELETE,
                403
            );
        }

        if (language.isDefault) {
            throw new AppError(
                LanguageMessages.DEFAULT_LANGUAGE_DELETE,
                403
            );
        }

        return this.languageRepository.deleteById(id);
    }

    async changeLanguageStatus(id: string, isActive: boolean) {

        const language = await this.languageRepository.findById(id);

        if (!language) {
            throw new AppError(
                LanguageMessages.NOT_FOUND,
                404
            );
        }

        if (language.isSystem) {
            throw new AppError(
                LanguageMessages.SYSTEM_LANGUAGE_UPDATE,
                403
            );
        }

        return this.languageRepository.updateById(
            id,
            {
                isActive,
            }
        );
    }
}