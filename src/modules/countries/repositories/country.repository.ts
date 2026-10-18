import { CountryModel } from "../models/country.model.js";
import type { ICountry, ICountryFilter } from "../interfaces/country.interface.js";
import { CountryCode, CountryCodeAlpha3, CountryNumericCode } from "../constants/country.enums.js";

export class CountryRepository {
    async create(data: Partial<ICountry>) {
        return CountryModel.create(data);
    }

    async findById(id: string) {
        return CountryModel.findById(id);
    }

    async findByCode(code: CountryCode | string) {
        return CountryModel.findOne({
            code: code as CountryCode,
        });
    }

    async findByAlpha3Code(alpha3Code: CountryCodeAlpha3 | string) {
        return CountryModel.findOne({
            alpha3Code: alpha3Code as CountryCodeAlpha3,
        });
    }

    async findByNumericCode(numericCode: CountryNumericCode | string) {
        return CountryModel.findOne({
            numericCode: numericCode as CountryNumericCode,
        });
    }

    async findByLocale(locale: string) {
        return CountryModel.findOne({
            locale,
        });
    }

    async findAll(filters: ICountryFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            code,
            alpha3Code,
            numericCode,
            dialCode,
            continent,
            currencyCode,
            locale,
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
                    alpha3Code: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    numericCode: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    dialCode: {
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
                {
                    currencyCode: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (code) {
            query.code = code;
        }

        if (alpha3Code) {
            query.alpha3Code = alpha3Code;
        }

        if (numericCode) {
            query.numericCode = numericCode;
        }

        if (dialCode) {
            query.dialCode = dialCode;
        }

        if (continent) {
            query.continent = continent;
        }

        if (currencyCode) {
            query.currencyCode = currencyCode;
        }

        if (locale) {
            query.locale = locale;
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
            CountryModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),

            CountryModel.countDocuments(query),
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
        const exists = await CountryModel.exists({ code: code as CountryCode });
        return !!exists;
    }

    async existsByAlpha3Code(alpha3Code: string): Promise<boolean> {
        const exists = await CountryModel.exists({ alpha3Code: alpha3Code as CountryCodeAlpha3 });
        return !!exists;
    }

    async existsByNumericCode(numericCode: string): Promise<boolean> {
        const exists = await CountryModel.exists({ numericCode: numericCode as CountryNumericCode });
        return !!exists;
    }

    async existsByLocale(locale: string): Promise<boolean> {
        const exists = await CountryModel.exists({ locale });
        return !!exists;
    }

    async updateById(id: string, data: Partial<ICountry>) {
        return CountryModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    async deleteById(id: string) {
        return CountryModel.findByIdAndDelete(id);
    }
}
