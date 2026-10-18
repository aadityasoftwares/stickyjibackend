import mongoose, { Schema, Model } from "mongoose";
import type { ICountryDocument } from "../interfaces/country.interface.js";
import {
    CountryCode,
    CountryCodeAlpha3,
    CountryNumericCode,
    CountryContinent,
    CurrencyCode,
    CountryDialCode,
} from "../constants/country.enums.js";
import { DEFAULT_COUNTRY_STATUS, DEFAULT_COUNTRY_SYSTEM } from "../constants/country.constants.js";

const CountrySchema = new Schema<ICountryDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        nativeName: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            enum: Object.values(CountryCode),
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },

        alpha3Code: {
            type: String,
            enum: Object.values(CountryCodeAlpha3),
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },

        numericCode: {
            type: String,
            enum: Object.values(CountryNumericCode),
            required: true,
            trim: true,
            unique: true,
        },

        dialCode: {
            type: String,
            enum: Object.values(CountryDialCode),
            required: true,
            trim: true,
        },

        continent: {
            type: String,
            enum: Object.values(CountryContinent),
            required: true,
        },

        currencyCode: {
            type: String,
            enum: Object.values(CurrencyCode),
            required: true,
            uppercase: true,
            trim: true,
        },

        currencySymbol: {
            type: String,
            required: true,
            trim: true,
        },

        locale: {
            type: String,
            required: true,
            trim: true,
        },

        isDefault: {
            type: Boolean,
            default: false,
        },

        isSystem: {
            type: Boolean,
            default: DEFAULT_COUNTRY_SYSTEM,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_COUNTRY_STATUS,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

// Unique indexes

CountrySchema.index({ code: 1 }, { unique: true });

CountrySchema.index({ alpha3Code: 1 }, { unique: true });

CountrySchema.index({ numericCode: 1 }, { unique: true });

CountrySchema.index({ locale: 1 }, { unique: true });

// Search / filter indexes

CountrySchema.index({
    name: 1,
});

CountrySchema.index({
    nativeName: 1,
});

CountrySchema.index({
    dialCode: 1,
});

CountrySchema.index({
    continent: 1,
});

CountrySchema.index({
    currencyCode: 1,
});

CountrySchema.index({
    isActive: 1,
});

CountrySchema.index({
    isDefault: 1,
});

CountrySchema.index({
    isSystem: 1,
});

CountrySchema.index({
    isActive: 1,
    isDefault: 1,
});

export const CountryModel: Model<ICountryDocument> = mongoose.model<ICountryDocument>(
    "Country",
    CountrySchema,
);
