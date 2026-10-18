import mongoose, { Schema, Model } from "mongoose";
import type { ITimezoneDocument } from "../interfaces/timezone.interface.js";
import { DEFAULT_TIMEZONE_STATUS, DEFAULT_TIMEZONE_SYSTEM } from "../constants/timezone.constants.js";
import { CountryCode } from "../../countries/constants/country.enums.js";

const TimezoneSchema = new Schema<ITimezoneDocument>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        countryCode: {
            type: String,
            enum: Object.values(CountryCode),
            required: true,
            uppercase: true,
            trim: true,
        },

        utcOffset: {
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
            default: DEFAULT_TIMEZONE_SYSTEM,
        },

        isActive: {
            type: Boolean,
            default: DEFAULT_TIMEZONE_STATUS,
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

TimezoneSchema.index({ code: 1 }, { unique: true });

TimezoneSchema.index({
    countryCode: 1,
});

TimezoneSchema.index({
    countryCode: 1,
    isActive: 1,
});

TimezoneSchema.index({
    countryCode: 1,
    isDefault: 1,
});

TimezoneSchema.index({
    name: 1,
});

TimezoneSchema.index({
    utcOffset: 1,
});

TimezoneSchema.index({
    isActive: 1,
});

TimezoneSchema.index({
    isDefault: 1,
});

TimezoneSchema.index({
    isSystem: 1,
});

TimezoneSchema.index({
    isActive: 1,
    isDefault: 1,
});

export const TimezoneModel: Model<ITimezoneDocument> = mongoose.model<ITimezoneDocument>(
    "Timezone",
    TimezoneSchema,
);
