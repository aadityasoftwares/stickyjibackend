import { TimezoneModel } from "../models/timezone.model.js";
import type { ITimezone, ITimezoneFilter } from "../interfaces/timezone.interface.js";
import { CountryCode } from "../../countries/constants/country.enums.js";

export class TimezoneRepository {
    async create(data: Partial<ITimezone>) {
        return TimezoneModel.create(data);
    }

    async findById(id: string) {
        return TimezoneModel.findById(id);
    }

    async findByCode(code: string) {
        return TimezoneModel.findOne({
            code: code.trim(),
        });
    }

    async findByCountryCode(countryCode: CountryCode | string) {
        return TimezoneModel.find({
            countryCode: countryCode.toUpperCase().trim() as CountryCode,
        });
    }

    async findByCodeAndCountry(code: string, countryCode: CountryCode | string) {
        return TimezoneModel.findOne({
            code: code.trim(),
            countryCode: countryCode.toUpperCase().trim() as CountryCode,
        });
    }

    async findAll(filters: ITimezoneFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            code,
            countryCode,
            utcOffset,
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
                    code: {
                        $regex: search,
                        $options: "i",
                    },
                },

                {
                    countryCode: {
                        $regex: search,
                        $options: "i",
                    },
                },

                {
                    utcOffset: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (code) {
            query.code = code.trim();
        }

        if (countryCode) {
            query.countryCode = countryCode.toUpperCase().trim();
        }

        if (utcOffset) {
            query.utcOffset = utcOffset.trim();
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
            TimezoneModel.find(query)
                .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            TimezoneModel.countDocuments(query),
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
        const exists = await TimezoneModel.exists({ code: code.trim() });
        return !!exists;
    }

    async existsByCodeAndCountry(code: string, countryCode: CountryCode | string): Promise<boolean> {
        const exists = await TimezoneModel.exists({
            code: code.trim(),
            countryCode: countryCode.toUpperCase().trim() as CountryCode,
        });
        return !!exists;
    }

    async updateById(id: string, data: Partial<ITimezone>) {
        return TimezoneModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    async deleteById(id: string) {
        return TimezoneModel.findByIdAndDelete(id);
    }
}
