import { PlanCode } from "../../../modules/plan/constants/plan.enums.js";
import { BillingInterval } from "../../../modules/planprice/constants/planPrice.enums.js";
import { CurrencyCode, CurrencyType } from "../../../modules/currency/constants/currency.enums.js";

export const SUBSCRIPTION_SEED_CURRENCY = {
    code: CurrencyCode.INR,
    name: "Indian Rupee",
    symbol: "₹",
    numericCode: "356",
    decimalPlaces: 2,
    type: CurrencyType.FIAT,
    isDefault: false,
    isActive: true,
    isSystem: true,
};

export const DEFAULT_SUBSCRIPTION_PRICES = [
    {
        planCode: PlanCode.INDIVIDUAL,
        billingInterval: BillingInterval.MONTHLY,
        amountMinor: 4900,
        sortOrder: 1,
    },
    {
        planCode: PlanCode.INDIVIDUAL,
        billingInterval: BillingInterval.YEARLY,
        amountMinor: 49000,
        sortOrder: 2,
    },
    { planCode: PlanCode.PRO, billingInterval: BillingInterval.MONTHLY, amountMinor: 9900, sortOrder: 1 },
    { planCode: PlanCode.PRO, billingInterval: BillingInterval.YEARLY, amountMinor: 99000, sortOrder: 2 },
] as const;

export const FREE_SUBSCRIPTION_PRICING =
    "FREE is implicitly INR 0 for both intervals; no PlanPrice rows or provider subscriptions.";
