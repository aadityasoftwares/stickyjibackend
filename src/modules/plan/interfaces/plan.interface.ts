import type { Document, Types } from "mongoose";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../constants/plan.enums.js";

export type PlanSortField = "name" | "code" | "sortOrder" | "createdAt" | "updatedAt";

export interface IPlan {
    name: string;
    code: PlanCode;
    description: string;
    type: PlanType;
    pricingModel: PlanPricingModel;
    trialDays: number;
    visibility: PlanVisibility;
    isPopular: boolean;
    sortOrder: number;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IPlanCreate {
    name: string;
    code: PlanCode;
    description: string;
    type?: PlanType;
    pricingModel?: PlanPricingModel;
    trialDays?: number;
    visibility?: PlanVisibility;
    isPopular?: boolean;
    sortOrder?: number;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
}

export interface IPlanUpdate {
    name?: string;
    code?: PlanCode;
    description?: string;
    type?: PlanType;
    pricingModel?: PlanPricingModel;
    trialDays?: number;
    visibility?: PlanVisibility;
    isPopular?: boolean;
    sortOrder?: number;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
}

export interface IPlanFilter {
    page?: number;
    limit?: number;
    search?: string;
    code?: PlanCode;
    type?: PlanType;
    pricingModel?: PlanPricingModel;
    visibility?: PlanVisibility;
    isPopular?: boolean;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    status?: "ACTIVE" | "INACTIVE" | "ALL";
    currencyId?: string;
    billingInterval?: any;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IPlanPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PlanStatusCounts {
    all: number;
    active: number;
    inactive: number;
}

export interface IPlanResponse {
    id: string;
    name: string;
    code: PlanCode;
    description: string;
    type: PlanType;
    pricingModel: PlanPricingModel;
    trialDays: number;
    visibility: PlanVisibility;
    isPopular: boolean;
    sortOrder: number;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IPlanDocument extends IPlan, Document {}

export interface IPlanPaginatedResult {
    data: IPlanDocument[];
    total: number;
}

// Subscription Plans API Interfaces
export interface ISubscriptionPlanPrice {
    id: string | null;
    billingInterval: "MONTHLY" | "YEARLY";
    amountMinor: number;
    amountMajor: number;
    currency: string;
    currencySymbol: string;
    formatted: string;
    monthlyEquivalent: number;
    savingsPercentage: number;
}

export interface ISubscriptionPlanFeature {
    code: string;
    name: string;
    description: string;
    category: string;
    type: string;
    isEnabled: boolean;
    limit: number;
    limitType: string;
    isUnlimited: boolean;
    formattedLimit: string;
}

export interface ISubscriptionPlanCard {
    id: string;
    name: string;
    code: PlanCode;
    type: PlanType;
    description: string;
    badge: string | null;
    isPopular: boolean;
    isDefault: boolean;
    trialDays: number;
    sortOrder: number;
    isCurrent: boolean;
    prices: ISubscriptionPlanPrice[];
    pricing: {
        monthly: ISubscriptionPlanPrice | null;
        yearly: ISubscriptionPlanPrice | null;
    };
    highlights: string[];
    features: ISubscriptionPlanFeature[];
    featureCategories: Record<string, ISubscriptionPlanFeature[]>;
}

export interface IComparisonMatrixRow {
    featureCode: string;
    featureName: string;
    category: string;
    description: string;
    type: string;
    plans: Record<
        string,
        {
            included: boolean;
            formattedValue: string;
            isUnlimited: boolean;
        }
    >;
}

export interface ISubscriptionPlansCatalogResponse {
    plans: ISubscriptionPlanCard[];
    billingIntervals: string[];
    currency: {
        code: string;
        symbol: string;
    };
    comparisonMatrix: IComparisonMatrixRow[];
    userSubscription: {
        planId: string;
        planCode: string;
        status: string;
        billingInterval: string | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
    } | null;
}