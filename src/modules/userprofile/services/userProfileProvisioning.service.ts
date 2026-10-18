import type { Types } from "mongoose";
import { UserProfileService } from "./userProfile.service.js";
import { CountryRepository } from "../../countries/repositories/country.repository.js";
import { TimezoneRepository } from "../../timezones/repositories/timezone.repository.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";

export interface IUserProfileRegistrationInput {
    firstName: string;
    lastName: string;

    countryCodeHint?: string;
    timezoneCode?: string;
    locale?: string;
}

export class UserProfileProvisioningService {
    private userProfileService: UserProfileService;
    private countryRepository: CountryRepository;
    private timezoneRepository: TimezoneRepository;

    constructor() {
        this.userProfileService = new UserProfileService();

        this.countryRepository = new CountryRepository();

        this.timezoneRepository = new TimezoneRepository();
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

        return this.userProfileService.createProfile(
            {
                userId,

                firstName: StringHelper.normalize(data.firstName),

                lastName: StringHelper.normalize(data.lastName),

                displayName: `${StringHelper.normalize(data.firstName)} ${StringHelper.normalize(data.lastName)}`,

                countryId: country._id,

                timezoneId: timezone._id,

                languageId: null,

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
}
