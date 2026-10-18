import { FeatureCode, FeatureCategory, FeatureType } from "../../../modules/feature/constants/feature.enums.js";
import { PlanCode } from "../../../modules/plan/constants/plan.enums.js";
import { PlanFeatureLimitType } from "../../../modules/planfeature/constants/planFeature.enums.js";

export const SUBSCRIPTION_LIMIT_CODES = {
    MAX_USERS: FeatureCode.MAX_USERS,
    MAX_WORKSPACES: FeatureCode.MAX_WORKSPACES,
    MAX_FOLDERS_PER_WORKSPACE: FeatureCode.MAX_FOLDERS_PER_WORKSPACE,
    MAX_ACTIVE_STICKY_NOTES: FeatureCode.MAX_ACTIVE_STICKY_NOTES,
    MAX_STORAGE_BYTES: FeatureCode.MAX_STORAGE_BYTES,
    MAX_UPLOAD_BYTES: FeatureCode.MAX_UPLOAD_BYTES,
} as const;

export const DEFAULT_SUBSCRIPTION_LIMITS = [
    { code: FeatureCode.MAX_USERS, name: "Personal billing seats", description: "Billing-owner seats; excludes other users collaborating in workspaces.", scope: "SUBSCRIPTION_OWNER", unit: "COUNT", limitType: PlanFeatureLimitType.USERS, values: [1, 1, 1] },
    { code: FeatureCode.MAX_WORKSPACES, name: "Owned workspaces", description: "Total workspaces owned across the subscription owner's scope.", scope: "SUBSCRIPTION_OWNER", unit: "COUNT", limitType: PlanFeatureLimitType.COUNT, values: [3, 5, 20] },
    { code: FeatureCode.MAX_FOLDERS_PER_WORKSPACE, name: "Folders per workspace", description: "Folders within one individual workspace, not an account-wide total.", scope: "WORKSPACE", unit: "COUNT", limitType: PlanFeatureLimitType.COUNT, values: [5, 10, 30] },
    { code: FeatureCode.MAX_ACTIVE_STICKY_NOTES, name: "Active sticky notes", description: "Aggregate active notes across all owned workspaces.", scope: "SUBSCRIPTION_OWNER", unit: "COUNT", limitType: PlanFeatureLimitType.COUNT, values: [500, 5000, 25000] },
    { code: FeatureCode.MAX_STORAGE_BYTES, name: "Retained storage bytes", description: "Total retained attachment storage in integer bytes across the billing scope.", scope: "SUBSCRIPTION_OWNER", unit: "BYTES", limitType: PlanFeatureLimitType.STORAGE, values: [104857600, 1073741824, 10737418240] },
    { code: FeatureCode.MAX_UPLOAD_BYTES, name: "Upload bytes", description: "Maximum integer bytes for one individual attachment.", scope: "ATTACHMENT", unit: "BYTES", limitType: PlanFeatureLimitType.STORAGE, values: [5242880, 10485760, 26214400] },
].map(definition => ({
    ...definition,
    category: definition.unit === "BYTES" ? FeatureCategory.STORAGE : FeatureCategory.CORE,
    type: FeatureType.QUOTA,
    isActive: true,
    isDefault: true,
    isSystem: true,
    limits: {
        [PlanCode.FREE]: definition.values[0]!,
        [PlanCode.INDIVIDUAL]: definition.values[1]!,
        [PlanCode.PRO]: definition.values[2]!,
    },
}));

export type DefaultSubscriptionPlanCode = PlanCode.FREE | PlanCode.INDIVIDUAL | PlanCode.PRO;
