import { Document, Types, } from "mongoose";
import { FeatureCode, FeatureCategory, FeatureType, } from "../constants/feature.enums.js";

export interface IFeature {

    name: string;
    code: FeatureCode;
    description: string;
    category: FeatureCategory;
    type: FeatureType;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}


export interface IFeatureFilter {

    page?: number;
    limit?: number;
    search?: string;
    code?: FeatureCode;
    category?: FeatureCategory;
    type?: FeatureType;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IFeatureDocument
    extends IFeature,
    Document {
}

export interface IFeaturePaginatedResult {
    data: IFeatureDocument[];
    total: number;
}