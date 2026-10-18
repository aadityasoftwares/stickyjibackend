import { Document, Types, } from "mongoose";
import { CountryCode } from "../../countries/constants/country.enums.js";
CountryCode

export interface ITimezone {
    name: string;
    code: string;
    countryCode: CountryCode;
    utcOffset: string;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}


export interface ITimezoneFilter {
    page?: number;
    limit?: number;
    search?: string;
    code?: string;
    countryCode?: CountryCode;
    utcOffset?: string;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}


export interface ITimezoneDocument
    extends ITimezone,
    Document {
}


export interface ITimezonePaginatedResult {
    data: ITimezoneDocument[];
    total: number;
}