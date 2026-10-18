import { Document, Types } from "mongoose";
import { LanguageDirection, LanguageCode, } from "../constants/language.enums.js";

export interface ILanguage {
    name: string;
    nativeName: string;
    code: LanguageCode;
    locale: string;
    direction: LanguageDirection;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILanguageFilter {
    page?: number;
    limit?: number;
    search?: string;
    code?: LanguageCode;
    locale?: string;
    direction?: LanguageDirection;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface ILanguageDocument
    extends ILanguage,
    Document { }

export interface ILanguagePaginatedResult {
    data: ILanguageDocument[];
    total: number;
}