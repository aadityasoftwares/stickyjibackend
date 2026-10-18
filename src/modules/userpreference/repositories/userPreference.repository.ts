import { Types } from "mongoose";
import { UserPreferenceModel } from "../models/userPreference.model.js";
import type {
    IUserPreference,
    IUserPreferenceFilter,
    UserPreferenceValue,
} from "../interfaces/userPreference.interface.js";
import type { UserPreferenceCategory, UserPreferenceValueType } from "../constants/userPreference.enums.js";

type UserPreferenceSeed = {
    key: string;
    value: UserPreferenceValue;
    valueType: UserPreferenceValueType;
    category: UserPreferenceCategory;
};

type UserPreferenceValueUpdate = {
    key: string;
    value: UserPreferenceValue;
};

export class UserPreferenceRepository {
    async create(data: Partial<IUserPreference>) {
        return UserPreferenceModel.create(data);
    }

    async findByUserIdAndKey(userId: string, key: string) {
        return UserPreferenceModel.findOne({
            userId,
            key,
        }).select("_id userId key value valueType category");
    }

    async findAllByUserId(userId: string, filters: IUserPreferenceFilter = {}) {
        const { key, category, valueType } = filters;

        const query: Record<string, unknown> = {
            userId,
        };

        if (key) {
            query.key = key;
        }

        if (category) {
            query.category = category;
        }

        if (valueType) {
            query.valueType = valueType;
        }

        return UserPreferenceModel.find(query).select("_id key value").sort({
            category: 1,
            key: 1,
        });
    }

    async existsByUserIdAndKey(userId: string, key: string): Promise<boolean> {
        return !!(await UserPreferenceModel.exists({
            userId,
            key,
        }));
    }

    async updateByUserIdAndKey(userId: string, key: string, data: Partial<IUserPreference>) {
        return UserPreferenceModel.findOneAndUpdate(
            {
                userId,
                key,
            },
            data,
            {
                new: true,
                runValidators: true,
            },
        ).select("_id userId key value valueType category");
    }

    async deleteByUserIdAndKey(userId: string, key: string) {
        return UserPreferenceModel.findOneAndDelete({
            userId,
            key,
        }).select("_id userId key value valueType category");
    }

    async deleteByUserId(userId: string) {
        return UserPreferenceModel.deleteMany({
            userId,
        });
    }

    async provisionMissingPreferences(userId: string, definitions: UserPreferenceSeed[]): Promise<void> {
        if (!definitions.length) {
            return;
        }

        const userObjectId = new Types.ObjectId(userId);

        await UserPreferenceModel.bulkWrite(
            definitions.map((definition) => ({
                updateOne: {
                    filter: {
                        userId: userObjectId,
                        key: definition.key,
                    },
                    update: {
                        $setOnInsert: {
                            userId: userObjectId,
                            key: definition.key,
                            value: definition.value,
                            valueType: definition.valueType,
                            category: definition.category,
                        },
                    },
                    upsert: true,
                },
            })),
            {
                ordered: false,
            },
        );
    }

    async updatePreferenceValues(userId: string, updates: UserPreferenceValueUpdate[]): Promise<void> {
        if (!updates.length) {
            return;
        }

        await UserPreferenceModel.bulkWrite(
            updates.map((update) => ({
                updateOne: {
                    filter: {
                        userId,
                        key: update.key,
                    },
                    update: {
                        $set: {
                            value: update.value,
                        },
                    },
                },
            })),
            {
                ordered: false,
            },
        );
    }
}
