import { Document, Types, } from "mongoose";
import { CountryCode, CountryCodeAlpha3, CountryNumericCode, CountryContinent, CurrencyCode, CountryDialCode, } from "../constants/country.enums.js";


export interface ICountry {
    name: string;
    nativeName: string;
    code: CountryCode;
    alpha3Code: CountryCodeAlpha3;
    numericCode: CountryNumericCode;
    dialCode: CountryDialCode;
    continent: CountryContinent;
    currencyCode: CurrencyCode;
    currencySymbol: string;
    locale: string;
    isDefault: boolean;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}


export interface ICountryFilter {
    page?: number;
    limit?: number;
    search?: string;
    code?: CountryCode;
    alpha3Code?: CountryCodeAlpha3;
    numericCode?: CountryNumericCode;
    dialCode?: CountryDialCode;
    continent?: CountryContinent;
    currencyCode?: CurrencyCode;
    locale?: string;
    isDefault?: boolean;
    isSystem?: boolean;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}


export interface ICountryDocument
    extends ICountry,
    Document { }