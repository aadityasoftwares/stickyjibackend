import { PlanFeatureLimitType } from "../constants/planFeature.enums.js";
import { IPlanFeature, IPlanFeatureFilter } from "../interfaces/planfeature.interface.js";
import { PlanFeatureModel } from "../models/planfeature.model.js";

export class PlanFeatureRepository {
    async create(data: Partial<IPlanFeature>) {
        return PlanFeatureModel.create(data);
    }

    async findById(id: string) {
        return PlanFeatureModel.findById(id).populate("planId").populate("featureId");
    }

    async findByPlanAndFeature(planId: string, featureId: string) {
        return PlanFeatureModel.findOne({
            planId,
            featureId,
        })
            .populate("planId")
            .populate("featureId");
    }

    async findAll(filters: IPlanFeatureFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            planId,
            featureId,
            limitType,
            isEnabled,
            isUnlimited,
            sortBy = "sortOrder",
            sortOrder = "asc",
        } = filters;

        const query: any = {};

        if (search) {
            query.$or = [
                {
                    limitType: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (planId) {
            query.planId = planId;
        }

        if (featureId) {
            query.featureId = featureId;
        }

        if (limitType) {
            query.limitType = limitType;
        }

        if (isEnabled !== undefined) {
            query.isEnabled = isEnabled;
        }

        if (isUnlimited !== undefined) {
            query.isUnlimited = isUnlimited;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            PlanFeatureModel.find(query)
                .populate("planId")
                .populate("featureId")
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),
            PlanFeatureModel.countDocuments(query),
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

    async existsByPlanAndFeature(planId: string, featureId: string): Promise<boolean> {
        const exists = await PlanFeatureModel.exists({
            planId,
            featureId,
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<IPlanFeature>) {
        return PlanFeatureModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        })
            .populate("planId")
            .populate("featureId");
    }

    async deleteById(id: string) {
        return PlanFeatureModel.findByIdAndDelete(id);
    }
}
