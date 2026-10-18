import { LocalizationLanguage } from "./localization.enums.js";
export const DEFAULT_LOCALIZATION_STATUS = true;
export const DEFAULT_LANGUAGE = LocalizationLanguage.ENGLISH;
export const DEFAULT_LOCALE = "en-IN";

export const SUPPORTED_LANGUAGES = [
    LocalizationLanguage.ENGLISH,
    LocalizationLanguage.HINDI,
    LocalizationLanguage.GUJARATI,
];

export const LANGUAGE_CODES = {
    [LocalizationLanguage.ENGLISH]: "en",
    [LocalizationLanguage.HINDI]: "hi",
    [LocalizationLanguage.GUJARATI]: "gu",
};

export const LANGUAGE_LOCALES = {
    [LocalizationLanguage.ENGLISH]: "en-IN",
    [LocalizationLanguage.HINDI]: "hi-IN",
    [LocalizationLanguage.GUJARATI]: "gu-IN",
};
