import { Types, type PipelineStage, type QueryFilter } from "mongoose";
import { PlanModel } from "../models/plan.model.js";
import type {
    IPlan,
    IPlanDocument,
    IPlanFilter,
    PlanStatusCounts,
} from "../interfaces/plan.interface.js";
import { PlanCode, PlanType } from "../constants/plan.enums.js";
import { PLAN_CONSTANTS, PLAN_STATUS_FILTER_LABELS } from "../constants/plan.constants.js";
import type { PlanListFilters } from "../validations/planList.schema.js";
import { planListSort } from "../utils/planList.util.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

const PLAN_SELECT = {
    _id: 1,
    name: 1,
    code: 1,
    description: 1,
    type: 1,
    pricingModel: 1,
    trialDays: 1,
    visibility: 1,
    isPopular: 1,
    sortOrder: 1,
    isDefault: 1,
    isSystem: 1,
    isActive: 1,
    createdBy: 1,
    updatedBy: 1,
    createdAt: 1,
    updatedAt: 1,
} as const;

export class PlanRepository {
    // Subscription reads deliberately avoid legacy currency population.
    async findSubscriptionPlan(id: string) {
        return PlanModel.findById(id)
            .select("_id name code type visibility pricingModel isActive")
            .lean()
            .exec();
    }

    async findActiveFreePlan() {
        return PlanModel.findOne({ code: PlanCode.FREE, type: PlanType.FREE, isActive: true })
            .select("_id name code type visibility pricingModel isActive")
            .lean()
            .exec();
    }

    async create(data: Partial<IPlan>) {
        return PlanModel.create(data);
    }

    async findById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return PlanModel.findById(id).select(PLAN_SELECT).lean().exec();
    }

    async findByCode(code: string) {
        return PlanModel.findOne({ code: code.toUpperCase().trim() as PlanCode })
            .select(PLAN_SELECT)
            .lean()
            .exec();
    }

    async list(filters: PlanListFilters) {
        const { skip, limit } = getPagination(filters.page, filters.limit);
        const match: QueryFilter<IPlanDocument> = {};

        if (filters.search) {
            const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            match.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { code: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } },
            ];
        }

        if (filters.code) match.code = filters.code;
        if (filters.type) match.type = filters.type;
        if (filters.pricingModel) match.pricingModel = filters.pricingModel;
        if (filters.visibility) match.visibility = filters.visibility;
        if (filters.isPopular !== undefined) match.isPopular = filters.isPopular;
        if (filters.isDefault !== undefined) match.isDefault = filters.isDefault;
        if (filters.isSystem !== undefined) match.isSystem = filters.isSystem;

        const effectiveStatus = filters.isActive !== undefined
            ? (filters.isActive ? "ACTIVE" : "INACTIVE")
            : (filters.status ?? "ACTIVE");

        const statusMatchStages: PipelineStage.Match[] = effectiveStatus === "ALL"
            ? []
            : [{ $match: { isActive: effectiveStatus === "ACTIVE" } }];

        const sort = planListSort(filters);

        const pipeline: PipelineStage[] = [
            { $match: match },
            { $project: PLAN_SELECT },
            {
                $facet: {
                    data: [
                        ...statusMatchStages,
                        { $sort: sort },
                        { $skip: skip },
                        { $limit: limit },
                    ],
                    counts: [{ $group: { _id: "$isActive", total: { $sum: 1 } } }],
                },
            },
        ];

        const query = PlanModel.aggregate<{
            data: IPlanDocument[];
            counts: { _id: boolean; total: number }[];
        }>(pipeline);

        if ("name" in sort || "code" in sort) {
            query.collation({ locale: "en", strength: 2 });
        }

        const [result] = await query.exec();

        const counts: PlanStatusCounts = { all: 0, active: 0, inactive: 0 };
        for (const count of result?.counts ?? []) {
            if (count._id === true) counts.active = count.total;
            if (count._id === false) counts.inactive = count.total;
        }
        counts.all = counts.active + counts.inactive;

        const total = effectiveStatus === "ALL"
            ? counts.all
            : effectiveStatus === "ACTIVE"
              ? counts.active
              : counts.inactive;

        return {
            data: result?.data ?? [],
            pagination: paginationMeta(filters.page, limit, total),
            counts,
            statusFilters: Object.entries(PLAN_STATUS_FILTER_LABELS).map(([value, label]) => ({
                value,
                label,
            })),
        };
    }

    async findAll(filters: IPlanFilter = {}) {
        const {
            page = PLAN_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = PLAN_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            search,
            code,
            type,
            pricingModel,
            visibility,
            isPopular,
            isDefault,
            isSystem,
            isActive,
            sortBy = PLAN_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder = PLAN_CONSTANTS.DEFAULT_SORT_ORDER,
        } = filters;

        const query: QueryFilter<IPlanDocument> = {};

        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { code: { $regex: escaped, $options: "i" } },
                { description: { $regex: escaped, $options: "i" } },
            ];
        }

        if (code) query.code = code.toUpperCase().trim() as PlanCode;
        if (type) query.type = type;
        if (pricingModel) query.pricingModel = pricingModel;
        if (visibility) query.visibility = visibility;
        if (isPopular !== undefined) query.isPopular = isPopular;
        if (isDefault !== undefined) query.isDefault = isDefault;
        if (isSystem !== undefined) query.isSystem = isSystem;
        if (isActive !== undefined) query.isActive = isActive;

        const skip = (page - 1) * limit;
        const direction = sortOrder === "desc" ? -1 : 1;

        const [data, total] = await Promise.all([
            PlanModel.find(query)
                .select(PLAN_SELECT)
                .sort({ [sortBy]: direction, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            PlanModel.countDocuments(query).exec(),
        ]);

        return {
            data,
            pagination: paginationMeta(page, limit, total),
        };
    }

    async existsByCode(code: string): Promise<boolean> {
        const exists = await PlanModel.exists({ code: code.toUpperCase().trim() as PlanCode });
        return !!exists;
    }

    async existsById(id: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(id)) return false;
        const exists = await PlanModel.exists({ _id: new Types.ObjectId(id) });
        return !!exists;
    }

    async updateById(id: string, data: Partial<IPlan>) {
        return PlanModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: data },
            { returnDocument: "after", runValidators: true },
        )
            .select(PLAN_SELECT)
            .lean()
            .exec();
    }

    async updateStatus(id: string, isActive: boolean, updatedBy?: Types.ObjectId | null) {
        return PlanModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: { isActive, ...(updatedBy !== undefined ? { updatedBy } : {}) } },
            { returnDocument: "after", runValidators: true },
        )
            .select(PLAN_SELECT)
            .lean()
            .exec();
    }

    async deleteById(id: string) {
        return PlanModel.findByIdAndDelete(new Types.ObjectId(id))
            .select(PLAN_SELECT)
            .lean()
            .exec();
    }

    async rollbackById(id: string, data: Record<string, unknown>) {
        return PlanModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: data },
            { returnDocument: "after", runValidators: false, timestamps: false },
        ).exec();
    }
}
