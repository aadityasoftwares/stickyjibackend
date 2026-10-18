import { Document, Types } from "mongoose";
import {
    SystemSettingKey,
    SystemSettingCategory,
    SystemSettingValueType,
} from "../constants/systemSetting.enums.js";

export type SystemSettingValue =
    | string
    | number
    | boolean
    | Record<string, unknown>
    | null;

export interface ISystemSetting {
    key: SystemSettingKey;
    value: SystemSettingValue;
    valueType: SystemSettingValueType;
    category: SystemSettingCategory;
    description: string;
    defaultValue: SystemSettingValue;
    isEditable: boolean;
    isPublic: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISystemSettingFilter {
    page?: number;
    limit?: number;
    search?: string;
    key?: SystemSettingKey;
    category?: SystemSettingCategory;
    valueType?: SystemSettingValueType;
    isEditable?: boolean;
    isPublic?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface ISystemSettingDocument extends ISystemSetting, Document { }

export interface ISystemSettingPaginatedResult {
    data: ISystemSettingDocument[];
    total: number;
}