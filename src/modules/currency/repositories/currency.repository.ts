import { CurrencyModel } from "../models/currency.model.js";
import type { ICurrency, ICurrencyFilter } from "../interfaces/currency.interface.js";
import { CurrencyCode } from "../constants/currency.enums.js";

export class CurrencyRepository {
    async create(data: Partial<ICurrency>) {
        return CurrencyModel.create(data);
    }

    async findById(id: string) {
        return CurrencyModel.findById(id);
    }

    async findByCode(code: CurrencyCode | string) {
        return CurrencyModel.findOne({
            code: code.toUpperCase().trim() as CurrencyCode,
        });
    }

    async findByNumericCode(numericCode: string) {
        return CurrencyModel.findOne({
            numericCode: numericCode.trim(),
        });
    }

    async findAll(filters: ICurrencyFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            code,
            numericCode,
            type,
            decimalPlaces,
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
                    symbol: {
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
            ];
        }

        if (code) {
            query.code = code.toUpperCase().trim();
        }

        if (numericCode) {
            query.numericCode = numericCode.trim();
        }

        if (type) {
            query.type = type;
        }

        if (decimalPlaces !== undefined) {
            query.decimalPlaces = decimalPlaces;
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
            CurrencyModel.find(query)
                .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit),

            CurrencyModel.countDocuments(query),
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
        const exists = await CurrencyModel.exists({
            code: code.toUpperCase().trim() as CurrencyCode,
        });
        return !!exists;
    }

    async existsByNumericCode(numericCode: string): Promise<boolean> {
        const exists = await CurrencyModel.exists({ numericCode: numericCode.trim() });
        return !!exists;
    }

    async updateById(id: string, data: Partial<ICurrency>) {
        return CurrencyModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    async deleteById(id: string) {
        return CurrencyModel.findByIdAndDelete(id);
    }
}
