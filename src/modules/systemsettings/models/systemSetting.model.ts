import mongoose, { Schema, Model } from "mongoose";
import type { ISystemSettingDocument } from "../interfaces/systemSetting.interface.js";
import {
    SystemSettingKey,
    SystemSettingCategory,
    SystemSettingValueType,
} from "../constants/systemSetting.enums.js";
import {
    DEFAULT_SYSTEM_SETTING_EDITABLE,
    DEFAULT_SYSTEM_SETTING_PUBLIC,
    DEFAULT_SYSTEM_SETTING_CATEGORY,
    DEFAULT_SYSTEM_SETTING_VALUE_TYPE,
} from "../constants/systemSetting.constants.js";

const SystemSettingSchema = new Schema<ISystemSettingDocument>(
    {
        key: {
            type: String,
            enum: Object.values(SystemSettingKey),
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },
        value: {
            type: Schema.Types.Mixed,
            required: true,
        },
        valueType: {
            type: String,
            enum: Object.values(SystemSettingValueType),
            required: true,
            default: DEFAULT_SYSTEM_SETTING_VALUE_TYPE,
        },
        category: {
            type: String,
            enum: Object.values(SystemSettingCategory),
            required: true,
            default: DEFAULT_SYSTEM_SETTING_CATEGORY,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        defaultValue: {
            type: Schema.Types.Mixed,
            default: null,
        },
        isEditable: {
            type: Boolean,
            default: DEFAULT_SYSTEM_SETTING_EDITABLE,
        },
        isPublic: {
            type: Boolean,
            default: DEFAULT_SYSTEM_SETTING_PUBLIC,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

SystemSettingSchema.index({ key: 1 }, { unique: true });
SystemSettingSchema.index({ category: 1 });
SystemSettingSchema.index({ valueType: 1 });
SystemSettingSchema.index({ isEditable: 1 });
SystemSettingSchema.index({ isPublic: 1 });
SystemSettingSchema.index({ category: 1, isPublic: 1 });
SystemSettingSchema.index({ category: 1, isEditable: 1 });

export const SystemSettingModel: Model<ISystemSettingDocument> = mongoose.model<ISystemSettingDocument>(
    "SystemSetting",
    SystemSettingSchema,
);
