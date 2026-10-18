import mongoose, { Model, Schema } from "mongoose";
import type { IUserPreferenceDocument } from "../interfaces/userPreference.interface.js";
import { UserPreferenceCategory, UserPreferenceValueType } from "../constants/userPreference.enums.js";

const UserPreferenceSchema = new Schema<IUserPreferenceDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        key: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
        },
        value: {
            type: Schema.Types.Mixed,
            required: true,
        },
        valueType: {
            type: String,
            enum: Object.values(UserPreferenceValueType),
            required: true,
        },
        category: {
            type: String,
            enum: Object.values(UserPreferenceCategory),
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

UserPreferenceSchema.index(
    {
        userId: 1,
        key: 1,
    },
    {
        unique: true,
        name: "user_preference_user_key",
    },
);

UserPreferenceSchema.index(
    {
        userId: 1,
        category: 1,
    },
    {
        name: "user_preference_user_category",
    },
);

export const UserPreferenceModel: Model<IUserPreferenceDocument> = mongoose.model<IUserPreferenceDocument>(
    "UserPreference",
    UserPreferenceSchema,
);
