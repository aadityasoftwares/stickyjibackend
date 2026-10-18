import { LanguageModel } from "../models/language.model.js";
import type { ILanguage, ILanguageFilter } from "../interfaces/language.interface.js";
import { LanguageCode } from "../constants/language.enums.js";

export class LanguageRepository {
    async create(data: Partial<ILanguage>) {
        return LanguageModel.create(data);
    }

    async findById(id: string) {
        return LanguageModel.findById(id);
    }

    async findByCode(code: LanguageCode | string) {
        return LanguageModel.findOne({
            code: code.toLowerCase().trim() as LanguageCode,
        });
    }

    async findByLocale(locale: string) {
        return LanguageModel.findOne({
            locale: locale.trim(),
        });
    }

    async findAll(filters: ILanguageFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            code,
            locale,
            direction,
            isDefault,
            isSystem,
            isActive,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: any = {};

        if (search) {
            query.$or = [
                {
                    name: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    nativeName: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    code: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    locale: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (code) {
            query.code = code.toLowerCase().trim();
        }

        if (locale) {
            query.locale = locale.trim();
        }

        if (direction) {
            query.direction = direction;
        }

        if (isDefault !== undefined) {
            query.isDefault = isDefault;
        }

        if (isSystem !== undefined) {
            query.isSystem = isSystem;
        }

        if (isActive !== undefined) {
            query.isActive = isActive;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            LanguageModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),

            LanguageModel.countDocuments(query),
        ]);

        return {
            data,

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async existsByCode(code: string): Promise<boolean> {
        const exists = await LanguageModel.exists({ code: code.toLowerCase().trim() as LanguageCode });
        return !!exists;
    }

    async existsByLocale(locale: string): Promise<boolean> {
        const exists = await LanguageModel.exists({ locale: locale.trim() });
        return !!exists;
    }

    async updateById(id: string, data: Partial<ILanguage>) {
        return LanguageModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    async deleteById(id: string) {
        return LanguageModel.findByIdAndDelete(id);
    }
}
