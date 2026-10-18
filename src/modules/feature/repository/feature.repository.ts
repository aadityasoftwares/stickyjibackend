import { FeatureModel } from "../models/feature.model.js";
import type { IFeature, IFeatureFilter, } from "../interfaces/feature.interface.js";
import { FeatureCode, } from "../constants/feature.enums.js";

export class FeatureRepository {

    async create(data: Partial<IFeature>) {
        return FeatureModel.create(data);
    }

    async findById(id: string) {
        return FeatureModel.findById(id);
    }

    async findByCode(code: FeatureCode | string) {

        return FeatureModel.findOne({
            code: code.toUpperCase().trim() as FeatureCode,
        });
    }

    async findAll(filters: IFeatureFilter = {}) {

        const {
            page = 1,
            limit = 10,
            search,
            code,
            category,
            type,
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
                    description: {
                        $regex: search,
                        $options: "i",
                    },
                },

                {
                    category: {
                        $regex: search,
                        $options: "i",
                    },
                },

            ];
        }


        if (code) {
            query.code = code.toUpperCase().trim();
        }

        if (category) {
            query.category = category;
        }

        if (type) {
            query.type = type;
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

        const [data, total] =
            await Promise.all([

                FeatureModel.find(query).sort({ [sortBy]: sortOrder === "asc" ? 1 : -1, })
                    .skip(skip)
                    .limit(limit),

                FeatureModel.countDocuments(
                    query
                ),
            ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(
                        total / limit
                    ),
            },
        };
    }

    async existsByCode(code: string): Promise<boolean> {

        const exists = await FeatureModel.exists({
            code: code.toUpperCase().trim() as FeatureCode,
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<IFeature>) {

        return FeatureModel.findByIdAndUpdate(
            id,
            data,
            {
                new: true,
                runValidators: true,
            }
        );
    }

    async deleteById(id: string) {
        return FeatureModel.findByIdAndDelete(
            id
        );
    }
}