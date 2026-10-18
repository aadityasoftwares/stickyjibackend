import type { Document, Types } from "mongoose";
import type {
    UserPreferenceCategory,
    UserPreferenceValueType,
} from "../constants/userPreference.enums.js";

export type UserPreferenceValue =
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[];

export interface IUserPreference {
    _id?: Types.ObjectId;
    userId: Types.ObjectId;
    key: string;
    value: UserPreferenceValue;
    valueType: UserPreferenceValueType;
    category: UserPreferenceCategory;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUserPreferenceDocument extends IUserPreference, Document {
    _id: Types.ObjectId;
}

export interface IUserPreferenceCreate {
    userId: Types.ObjectId | string;
    key: string;
    value: UserPreferenceValue;
    valueType: UserPreferenceValueType;
    category: UserPreferenceCategory;
}

export interface IUserPreferenceUpdate {
    value: UserPreferenceValue;
}

export interface IUserPreferenceFilter {
    key?: string;
    category?: UserPreferenceCategory;
    valueType?: UserPreferenceValueType;
}

export interface IUserPreferenceResponse {
    id: string;
    key: string;
    value: UserPreferenceValue;
}