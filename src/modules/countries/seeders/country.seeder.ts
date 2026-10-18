import { CountryModel } from "../models/country.model.js";
import {
    CountryCode,
    CountryCodeAlpha3,
    CountryNumericCode,
    CountryContinent,
    CurrencyCode,
    CountryDialCode,
} from "../constants/country.enums.js";

export const seedCountries = async (): Promise<void> => {
    await CountryModel.findOneAndUpdate(
        {
            code: CountryCode.INDIA,
        },
        {
            $set: {
                name: "India",
                nativeName: "भारत",

                code: CountryCode.INDIA,
                alpha3Code: CountryCodeAlpha3.INDIA,
                numericCode: CountryNumericCode.INDIA,

                dialCode: CountryDialCode.INDIA,

                continent: CountryContinent.ASIA,

                currencyCode: CurrencyCode.INR,
                currencySymbol: "₹",

                locale: "en-IN",

                isDefault: true,
                isSystem: true,
                isActive: true,

                createdBy: null,
                updatedBy: null,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        },
    );

    console.log("Default India country seeded successfully.");
};
