import { Document } from "mongoose";
import { LocalizationLanguage, LocalizationDirection } from "../constants/localization.enums.js";

export interface ILocalization {
    language: LocalizationLanguage;
    languageCode: string;
    locale: string;
    direction: LocalizationDirection;
    key: string;
    value: string;
    module: string;
    description?: string;
    isActive: boolean;
    isDefault: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILocalizationFilter {
    page?: number;
    limit?: number;
    search?: string;
    language?: LocalizationLanguage;
    languageCode?: string;
    locale?: string;
    module?: string;
    isActive?: boolean;
    isDefault?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface ILocalizationDocument extends ILocalization, Document {}
