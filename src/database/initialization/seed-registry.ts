import { executeLanguagesSeed } from "./seeds/languages.seed.js";
import { executeCountriesSeed } from "./seeds/countries.seed.js";
import { executeCurrenciesSeed } from "./seeds/currencies.seed.js";
import { executeTimezonesSeed } from "./seeds/timezones.seed.js";
import { executeSystemSettingsSeed } from "./seeds/system-settings.seed.js";
import { executePermissionsSeed } from "./seeds/permissions.seed.js";
import { executeRolesSeed } from "./seeds/roles.seed.js";
import { executeSubscriptionCatalogSeed } from "./seeds/subscription-catalog.seed.js";

import { LanguageModel } from "../../modules/languages/models/language.model.js";
import { LanguageCode } from "../../modules/languages/constants/language.enums.js";
import { CountryModel } from "../../modules/countries/models/country.model.js";
import { CountryCode } from "../../modules/countries/constants/country.enums.js";
import { CurrencyModel } from "../../modules/currency/models/currency.model.js";
import { CurrencyCode } from "../../modules/currency/constants/currency.enums.js";
import { TimezoneModel } from "../../modules/timezones/models/timezone.model.js";
import { SystemSettingModel } from "../../modules/systemsettings/models/systemSetting.model.js";
import { SYSTEM_SETTING_DEFAULTS } from "../../modules/systemsettings/constants/systemSetting.constants.js";
import { PermissionModel } from "../../modules/permissions/models/permission.model.js";
import { PERMISSION_DEFINITIONS } from "../../modules/permissions/constants/permission.constants.js";
import { RoleModel } from "../../modules/roles/models/role.model.js";
import { SYSTEM_ROLE_CODES } from "../../modules/roles/constants/role.constants.js";
import { PlanModel } from "../../modules/plan/models/plan.model.js";
import { FeatureModel } from "../../modules/feature/models/feature.model.js";
import { PlanFeatureModel } from "../../modules/planfeature/models/planfeature.model.js";
import { PlanPriceModel } from "../../modules/planprice/models/planPrice.model.js";
import { PlanCode } from "../../modules/plan/constants/plan.enums.js";

export interface ISeedStep {
    id: string;
    name: string;
    description: string;
    execute: () => Promise<void>;
}

export interface IVerificationResult {
    valid: boolean;
    errors: string[];
    details: Record<string, { count: number; expected?: number; valid: boolean }>;
}

export const SEED_REGISTRY: readonly ISeedStep[] = [
    {
        id: "languages",
        name: "Languages",
        description: "Default platform languages (English)",
        execute: executeLanguagesSeed,
    },
    {
        id: "countries",
        name: "Countries",
        description: "Default platform countries (India)",
        execute: executeCountriesSeed,
    },
    {
        id: "currencies",
        name: "Currencies",
        description: "Default platform currencies (INR)",
        execute: executeCurrenciesSeed,
    },
    {
        id: "timezones",
        name: "Timezones",
        description: "Default platform timezones (Asia/Kolkata)",
        execute: executeTimezonesSeed,
    },
    {
        id: "system-settings",
        name: "System Settings",
        description: "Essential platform configuration and system defaults",
        execute: executeSystemSettingsSeed,
    },
    {
        id: "permissions",
        name: "Permissions",
        description: "System permissions definitions and access controls",
        execute: executePermissionsSeed,
    },
    {
        id: "roles",
        name: "Roles",
        description: "Core system roles with resolved permission mappings",
        execute: executeRolesSeed,
    },
    {
        id: "subscription-catalog",
        name: "Subscription Catalog",
        description: "Commercial subscription plans, features, quotas, and INR pricing",
        execute: executeSubscriptionCatalogSeed,
    },
] as const;

export async function verifyDatabaseInitialization(): Promise<IVerificationResult> {
    const errors: string[] = [];
    const details: IVerificationResult["details"] = {};

    // 1. Languages
    const languageCount = await LanguageModel.countDocuments({ code: LanguageCode.ENGLISH, isDefault: true, isActive: true });
    details.languages = { count: languageCount, expected: 1, valid: languageCount >= 1 };
    if (languageCount < 1) {
        errors.push("Default English language record is missing or inactive.");
    }

    // 2. Countries
    const countryCount = await CountryModel.countDocuments({ code: CountryCode.INDIA, isDefault: true, isActive: true });
    details.countries = { count: countryCount, expected: 1, valid: countryCount >= 1 };
    if (countryCount < 1) {
        errors.push("Default India country record is missing or inactive.");
    }

    // 3. Currencies
    const currencyCount = await CurrencyModel.countDocuments({ code: CurrencyCode.INR, isActive: true });
    details.currencies = { count: currencyCount, expected: 1, valid: currencyCount >= 1 };
    if (currencyCount < 1) {
        errors.push("Default INR currency record is missing or inactive.");
    }

    // 4. Timezones
    const timezoneCount = await TimezoneModel.countDocuments({ code: "Asia/Kolkata", isActive: true });
    details.timezones = { count: timezoneCount, expected: 1, valid: timezoneCount >= 1 };
    if (timezoneCount < 1) {
        errors.push("Default Asia/Kolkata timezone record is missing or inactive.");
    }

    // 5. System Settings
    const expectedSettingsCount = SYSTEM_SETTING_DEFAULTS.length;
    const settingCount = await SystemSettingModel.countDocuments();
    details.systemSettings = { count: settingCount, expected: expectedSettingsCount, valid: settingCount >= expectedSettingsCount };
    if (settingCount < expectedSettingsCount) {
        errors.push(`Expected at least ${expectedSettingsCount} system settings, found ${settingCount}.`);
    }

    // 6. Permissions
    const expectedPermissionsCount = PERMISSION_DEFINITIONS.length;
    const permissionCount = await PermissionModel.countDocuments({ isActive: true, isSystem: true });
    details.permissions = { count: permissionCount, expected: expectedPermissionsCount, valid: permissionCount >= expectedPermissionsCount };
    if (permissionCount < expectedPermissionsCount) {
        errors.push(`Expected at least ${expectedPermissionsCount} system permissions, found ${permissionCount}.`);
    }

    // 7. Roles
    const requiredRoleCodes = Object.values(SYSTEM_ROLE_CODES) as string[];
    const existingRoles = await RoleModel.find({ code: { $in: requiredRoleCodes }, isSystem: true }).select("code permissions").lean();
    const missingRoles = requiredRoleCodes.filter(code => !existingRoles.some(role => role.code === code));
    const rolesValid = missingRoles.length === 0;
    details.roles = { count: existingRoles.length, expected: requiredRoleCodes.length, valid: rolesValid };
    if (!rolesValid) {
        errors.push(`Missing required system roles: ${missingRoles.join(", ")}.`);
    }

    // Check roles have permission IDs
    const superAdminRole = existingRoles.find(role => role.code === SYSTEM_ROLE_CODES.SUPER_ADMIN);
    if (superAdminRole && (!superAdminRole.permissions || superAdminRole.permissions.length === 0)) {
        errors.push("SUPER_ADMIN role has no associated permissions.");
    }

    // 8. Subscription Catalog
    const freePlan = await PlanModel.findOne({ code: PlanCode.FREE, isDefault: true, isActive: true }).lean();
    const individualPlan = await PlanModel.findOne({ code: PlanCode.INDIVIDUAL, isActive: true }).lean();
    const proPlan = await PlanModel.findOne({ code: PlanCode.PRO, isActive: true }).lean();
    const plansValid = !!(freePlan && individualPlan && proPlan);
    const planCount = await PlanModel.countDocuments({ isActive: true });
    details.plans = { count: planCount, expected: 3, valid: plansValid };
    if (!plansValid) {
        errors.push("One or more default subscription plans (FREE, INDIVIDUAL, PRO) are missing or inactive.");
    }

    const featureCount = await FeatureModel.countDocuments();
    details.features = { count: featureCount, expected: 21, valid: featureCount >= 21 };
    if (featureCount < 21) {
        errors.push(`Expected at least 21 features in catalog, found ${featureCount}.`);
    }

    const planFeatureCount = await PlanFeatureModel.countDocuments();
    details.planFeatures = { count: planFeatureCount, expected: 63, valid: planFeatureCount >= 63 };
    if (planFeatureCount < 63) {
        errors.push(`Expected at least 63 plan feature associations, found ${planFeatureCount}.`);
    }

    const planPriceCount = await PlanPriceModel.countDocuments({ isActive: true });
    details.planPrices = { count: planPriceCount, expected: 4, valid: planPriceCount >= 4 };
    if (planPriceCount < 4) {
        errors.push(`Expected 4 default plan prices for INDIVIDUAL and PRO, found ${planPriceCount}.`);
    }

    return {
        valid: errors.length === 0,
        errors,
        details,
    };
}
