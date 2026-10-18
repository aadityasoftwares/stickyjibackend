import { CountryCode } from "../../countries/constants/country.enums.js";
import { isValidTimezone, isTimezoneAvailableForCountry } from "../constants/timezone.constants.js";

export const TimezoneValidation = {
    countryCodes: Object.values(CountryCode),

    isValidTimezone(timezone: string): boolean {
        return isValidTimezone(timezone);
    },

    isTimezoneAvailableForCountry(countryCode: string, timezone: string): boolean {
        return isTimezoneAvailableForCountry(countryCode as CountryCode, timezone);
    },

    isValidUtcOffset(utcOffset: string): boolean {
        return /^[+-](0\d|1\d|2[0-3]):[0-5]\d$/.test(utcOffset);
    },
};
