import {
    PlanCode,
    PlanPricingModel,
    PlanType,
    PlanVisibility,
} from "../../../modules/plan/constants/plan.enums.js";

export const DEFAULT_SUBSCRIPTION_PLANS = [
    {
        code: PlanCode.FREE,
        name: "Free",
        description: "All essential productivity features with free usage limits.",
        type: PlanType.FREE,
        isDefault: true,
        sortOrder: 1,
    },
    {
        code: PlanCode.INDIVIDUAL,
        name: "Individual",
        description: "More capacity for personal productivity.",
        type: PlanType.PAID,
        isDefault: false,
        sortOrder: 2,
    },
    {
        code: PlanCode.PRO,
        name: "Pro",
        description: "Expanded capacity for power users.",
        type: PlanType.PAID,
        isDefault: false,
        sortOrder: 3,
    },
].map((plan) => ({
    ...plan,
    pricingModel: PlanPricingModel.FIXED,
    visibility: PlanVisibility.PUBLIC,
    isActive: true,
    isSystem: true,
    trialDays: 0,
    isPopular: false,
}));
