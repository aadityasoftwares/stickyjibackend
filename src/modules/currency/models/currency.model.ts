import mongoose, { Schema, Model, } from "mongoose";
import type { ICurrencyDocument, } from "../interfaces/currency.interface.js";
import { CurrencyCode, CurrencyType, } from "../constants/currency.enums.js";
import { DEFAULT_CURRENCY_STATUS, DEFAULT_CURRENCY_SYSTEM, DEFAULT_CURRENCY_TYPE, } from "../constants/currency.constants.js";

const CurrencySchema = new Schema<ICurrencyDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            enum: Object.values(CurrencyCode),
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },

        symbol: {
            type: String,
            required: true,
            trim: true,
        },

        numericCode: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        decimalPlaces: {
            type: Number,
            required: true,
            min: 0,
            max: 4,
        },

        type: {
            type: String,
            enum: Object.values(CurrencyType),
            required: true,
            default: DEFAULT_CURRENCY_TYPE,
        },

        isDefault: {
            type: Boolean,
            default: false,
        },

        isSystem: {
            type: Boolean,
            default: DEFAULT_CURRENCY_SYSTEM,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_CURRENCY_STATUS,
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
    }
);

CurrencySchema.index(
    { code: 1 },
    { unique: true }
);

CurrencySchema.index(
    { numericCode: 1 },
    { unique: true }
);

CurrencySchema.index({
    name: 1,
});

CurrencySchema.index({
    symbol: 1,
});

CurrencySchema.index({
    type: 1,
});

CurrencySchema.index({
    decimalPlaces: 1,
});

CurrencySchema.index({
    isActive: 1,
});

CurrencySchema.index({
    isDefault: 1,
});

CurrencySchema.index({
    isSystem: 1,
});

CurrencySchema.index({
    isActive: 1,
    isDefault: 1,
});

export const CurrencyModel:
    Model<ICurrencyDocument> =
    mongoose.model<ICurrencyDocument>(
        "Currency",
        CurrencySchema
    );