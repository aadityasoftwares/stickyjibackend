import { LocalizationModel } from "../models/localization.model.js";
import type { ILocalization, ILocalizationFilter } from "../interfaces/localization.interface.js";

export class LocalizationRepository {
    async create(data: Partial<ILocalization>) {
        return LocalizationModel.create(data);
    }

    async findById(id: string) {
        return LocalizationModel.findById(id);
    }

    async findByKey(key: string, locale: string) {
        return LocalizationModel.findOne({
            key: key.trim(),
            locale: locale.trim(),
        });
    }

    async findAll(filters: ILocalizationFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            language,
            languageCode,
            locale,
            module,
            isActive,
            isDefault,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: any = {};

        if (search) {
            query.$or = [
                {
                    key: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    value: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    module: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    language: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (language) {
            query.language = language;
        }

        if (languageCode) {
            query.languageCode = languageCode.toLowerCase().trim();
        }

        if (locale) {
            query.locale = locale.trim();
        }

        if (module) {
            query.module = module.toUpperCase().trim();
        }

        if (isActive !== undefined) {
            query.isActive = isActive;
        }

        if (isDefault !== undefined) {
            query.isDefault = isDefault;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            LocalizationModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),

            LocalizationModel.countDocuments(query),
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

    async existsByKey(key: string, locale: string): Promise<boolean> {
        const exists = await LocalizationModel.exists({
            key: key.trim(),
            locale: locale.trim(),
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<ILocalization>) {
        return LocalizationModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    async deleteById(id: string) {
        return LocalizationModel.findByIdAndDelete(id);
    }
}
