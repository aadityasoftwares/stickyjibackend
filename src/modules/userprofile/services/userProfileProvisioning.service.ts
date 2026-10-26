import type { Types } from "mongoose";
import { UserProfileService } from "./userProfile.service.js";
import { CountryRepository } from "../../countries/repositories/country.repository.js";
import { TimezoneRepository } from "../../timezones/repositories/timezone.repository.js";
import { LanguageRepository } from "../../languages/repositories/language.repository.js";
import { LanguageCode } from "../../languages/constants/language.enums.js";
import { LanguageModel } from "../../languages/models/language.model.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";

export interface IUserProfileRegistrationInput {
    firstName: string;
    lastName: string;

    countryCodeHint?: string;
    timezoneCode?: string;
    locale?: string;
    languageCode?: string;
}

export class UserProfileProvisioningService {
    private userProfileService: UserProfileService;
    private countryRepository: CountryRepository;
    private timezoneRepository: TimezoneRepository;
    private languageRepository: LanguageRepository;

    constructor(
        userProfileService?: UserProfileService,
        countryRepository?: CountryRepository,
        timezoneRepository?: TimezoneRepository,
        languageRepository?: LanguageRepository,
    ) {
        this.userProfileService = userProfileService ?? new UserProfileService();

        this.countryRepository = countryRepository ?? new CountryRepository();

        this.timezoneRepository = timezoneRepository ?? new TimezoneRepository();

        this.languageRepository = languageRepository ?? new LanguageRepository();
    }

    async provisionRegistrationProfile(
        userId: string | Types.ObjectId,
        data: IUserProfileRegistrationInput,
        context?: IAuditLogContext,
    ) {
        const countryCode = this.normalizeCountryCode(data.countryCodeHint);

        const timezoneCode = this.normalizeTimezoneCode(data.timezoneCode);

        const country = await this.countryRepository.findByCode(countryCode);

        if (!country) {
            throw new AppError(`Country '${countryCode}' is not configured.`, 503);
        }

        let timezone = await this.timezoneRepository.findByCodeAndCountry(timezoneCode, countryCode);

        if (!timezone && countryCode === "IN") {
            timezone = await this.timezoneRepository.findByCodeAndCountry("Asia/Kolkata", "IN");
        }

        if (!timezone) {
            throw new AppError(
                `Timezone '${timezoneCode}' is not configured for country '${countryCode}'.`,
                503,
            );
        }

        const language = await this.resolveLanguage(data.languageCode || data.locale);

        if (!language) {
            throw new AppError("Language 'en' is not configured.", 503);
        }

        return this.userProfileService.createProfile(
            {
                userId,

                firstName: StringHelper.normalize(data.firstName),

                lastName: StringHelper.normalize(data.lastName),

                displayName: `${StringHelper.normalize(data.firstName)} ${StringHelper.normalize(data.lastName)}`,

                countryId: country._id,

                timezoneId: timezone._id,

                languageId: language._id,

                currencyId: null,

                interests: [],
            },
            context,
        );
    }

    private normalizeCountryCode(value?: string): string {
        const countryCode = value?.trim().toUpperCase();

        return countryCode || "IN";
    }

    private normalizeTimezoneCode(value?: string): string {
        const timezone = value?.trim();

        if (!timezone) {
            return "Asia/Kolkata";
        }

        if (timezone === "Asia/Calcutta") {
            return "Asia/Kolkata";
        }

        return timezone;
    }

    private async resolveLanguage(localeOrCode?: string) {
        const normalized = localeOrCode?.trim();

        if (normalized) {
            const byLocale = await this.languageRepository.findByLocale(normalized);
            if (byLocale) {
                return byLocale;
            }

            const byCode = await this.languageRepository.findByCode(normalized);
            if (byCode) {
                return byCode;
            }

            const prefix = normalized.split(/[-_]/)[0];
            if (prefix) {
                const byPrefix = await this.languageRepository.findByCode(prefix);
                if (byPrefix) {
                    return byPrefix;
                }
            }
        }

        const defaultLanguage = await this.languageRepository.findByCode(LanguageCode.ENGLISH);
        if (defaultLanguage) {
            return defaultLanguage;
        }

        return this.languageRepository.findDefault();
    }
}
