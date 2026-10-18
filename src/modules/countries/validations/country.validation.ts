import {
    CountryCode,
    CountryCodeAlpha3,
    CountryNumericCode,
    CountryContinent,
    CurrencyCode,
    CountryDialCode,
} from "../constants/country.enums.js";

export const CountryValidation = {
    codes: Object.values(CountryCode),
    alpha3Codes: Object.values(CountryCodeAlpha3),
    numericCodes: Object.values(CountryNumericCode),
    continents: Object.values(CountryContinent),
    currencyCodes: Object.values(CurrencyCode),
    dialCodes: Object.values(CountryDialCode),
};
