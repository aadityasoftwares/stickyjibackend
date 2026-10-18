import { SystemSettingModel } from "../models/systemSetting.model.js";
import type { ISystemSetting, ISystemSettingFilter } from "../interfaces/systemSetting.interface.js";
import type { SystemSettingKey } from "../constants/systemSetting.enums.js";

export class SystemSettingRepository {
    async create(data: Partial<ISystemSetting>) {
        return SystemSettingModel.create(data);
    }

    async findById(id: string) {
        return SystemSettingModel.findById(id).populate("createdBy").populate("updatedBy");
    }

    async findByKey(key: SystemSettingKey | string) {
        return SystemSettingModel.findOne({
            key: key.toUpperCase().trim() as SystemSettingKey,
        })
            .populate("createdBy")
            .populate("updatedBy");
    }

    async findAll(filters: ISystemSettingFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            key,
            category,
            valueType,
            isEditable,
            isPublic,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: any = {};

        if (search) {
            query.$or = [
                { key: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }

        if (key) query.key = key.toUpperCase().trim();
        if (category) query.category = category;
        if (valueType) query.valueType = valueType;
        if (isEditable !== undefined) query.isEditable = isEditable;
        if (isPublic !== undefined) query.isPublic = isPublic;

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            SystemSettingModel.find(query)
                .populate("createdBy")
                .populate("updatedBy")
                .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            SystemSettingModel.countDocuments(query),
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

    async findPublicSettings() {
        return SystemSettingModel.find({ isPublic: true }).sort({
            category: 1,
            key: 1,
        });
    }

    async existsByKey(key: string): Promise<boolean> {
        const exists = await SystemSettingModel.exists({
            key: key.toUpperCase().trim() as SystemSettingKey,
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<ISystemSetting>) {
        return SystemSettingModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        })
            .populate("createdBy")
            .populate("updatedBy");
    }

    async resetById(
        id: string,
        defaultValue: ISystemSetting["defaultValue"],
        updatedBy?: ISystemSetting["updatedBy"],
    ) {
        return SystemSettingModel.findByIdAndUpdate(
            id,
            {
                value: defaultValue,
                updatedBy: updatedBy ?? null,
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate("createdBy")
            .populate("updatedBy");
    }
}
