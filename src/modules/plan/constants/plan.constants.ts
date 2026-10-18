import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "./plan.enums.js";

export const DEFAULT_PLAN_STATUS = true;
export const DEFAULT_PLAN_SYSTEM = true;
export const DEFAULT_PLAN_DEFAULT = false;
export const DEFAULT_PLAN_VISIBILITY = PlanVisibility.PUBLIC;
export const DEFAULT_PLAN_TYPE = PlanType.PAID;
export const DEFAULT_PLAN_BILLING_INTERVAL = BillingInterval.MONTHLY;
export const DEFAULT_PLAN_PRICING_MODEL = PlanPricingModel.FIXED;
export const DEFAULT_PLAN_TRIAL_DAYS = 0;
export const DEFAULT_PLAN_SORT_ORDER = 0;

export const DEFAULT_PLAN_CODE = PlanCode.FREE;
export const DEFAULT_PLAN_NAME = "Free";
export const DEFAULT_PLAN_DESCRIPTION = "Free plan with basic platform access.";
export const DEFAULT_PLAN_PRICE = 0;

export const PLAN_STATUS_FILTER_LABELS = {
    ALL: "All statuses",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
} as const;

export const PLAN_TYPE_LABELS = {
    [PlanType.FREE]: "Free",
    [PlanType.PAID]: "Paid",
    [PlanType.CUSTOM]: "Custom",
} as const;

export const PLAN_VISIBILITY_LABELS = {
    [PlanVisibility.PUBLIC]: "Public",
    [PlanVisibility.PRIVATE]: "Private",
} as const;

export const PLAN_PRICING_MODEL_LABELS = {
    [PlanPricingModel.FIXED]: "Fixed",
    [PlanPricingModel.CUSTOM]: "Custom",
} as const;

export const PLAN_CONSTANTS = {
    NAME: { MIN_LENGTH: 2, MAX_LENGTH: 100 },
    CODE: { MIN_LENGTH: 2, MAX_LENGTH: 50 },
    DESCRIPTION: { MAX_LENGTH: 500 },
    PAGINATION: { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 100 },
    SEARCH: { MAX_LENGTH: 100 },
    SORT_FIELDS: ["name", "code", "sortOrder", "createdAt", "updatedAt"],
    DEFAULT_SORT_BY: "sortOrder",
    DEFAULT_SORT_ORDER: "asc" as const,
    DEFAULT_VISIBILITY: PlanVisibility.PUBLIC,
    DEFAULT_TYPE: PlanType.PAID,
    DEFAULT_PRICING_MODEL: PlanPricingModel.FIXED,
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MAX_SEARCH_LENGTH: 100,
} as const;
