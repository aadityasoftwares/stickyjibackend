import { Document, Types, } from "mongoose";
import { PlanFeatureLimitType, } from "../constants/planFeature.enums.js";

export interface IPlanFeature {
    planId: Types.ObjectId;
    featureId: Types.ObjectId;
    isEnabled: boolean;
    limit?: number;
    limitType: PlanFeatureLimitType;
    isUnlimited: boolean;
    sortOrder: number;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IPlanFeatureFilter {
    page?: number;
    limit?: number;
    search?: string;
    planId?: Types.ObjectId | string;
    featureId?: Types.ObjectId | string;
    limitType?: PlanFeatureLimitType;
    isEnabled?: boolean;
    isUnlimited?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IPlanFeatureDocument
    extends IPlanFeature,
    Document {
}

export interface IPlanFeaturePaginatedResult {
    data: IPlanFeatureDocument[];
    total: number;
}