import { Document, Types, } from "mongoose";
import { CurrencyCode, CurrencyType, } from "../constants/currency.enums.js";

export interface ICurrency {
    name: string;
    code: CurrencyCode;
    symbol: string;
    numericCode: string;
    decimalPlaces: number;
    type: CurrencyType;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}


export interface ICurrencyFilter {
    page?: number;
    limit?: number;
    search?: string;
    code?: CurrencyCode;
    numericCode?: string;
    type?: CurrencyType;
    decimalPlaces?: number;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface ICurrencyDocument extends ICurrency, Document { }

export interface ICurrencyPaginatedResult {
    data: ICurrencyDocument[];
    total: number;
}