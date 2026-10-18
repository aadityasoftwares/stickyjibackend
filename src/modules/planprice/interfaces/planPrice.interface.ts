import type { Document, Types, } from "mongoose";
import type { BillingInterval, } from "../constants/planPrice.enums.js";

export interface IPlanPrice {
    planId: Types.ObjectId;
    currencyId: Types.ObjectId;
    billingInterval: BillingInterval;
    amountMinor: number;
    sortOrder: number;
    isActive: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IPlanPriceCreate {
    planId: Types.ObjectId | string;
    currencyId: Types.ObjectId | string;
    billingInterval: BillingInterval;
    amountMinor: number;
    sortOrder?: number;
    isActive?: boolean;
}

export interface IPlanPriceUpdate {
    amountMinor?: number;
    sortOrder?: number;
}

export interface IPlanPriceFilter {
    planId?: Types.ObjectId | string;
    currencyId?: Types.ObjectId | string;
    billingInterval?: BillingInterval;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IPlanPriceDocument
    extends IPlanPrice,
    Document {
}

export interface IPlanPricePaginatedResult {
    data: IPlanPriceDocument[];
    total: number;
}