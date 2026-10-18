import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../constants/plan.enums.js";
import { PLAN_CONSTANTS } from "../constants/plan.constants.js";
import type { PlanSortField } from "../interfaces/plan.interface.js";

export const PlanValidation = {
    codes: Object.values(PlanCode),
    types: Object.values(PlanType),
    pricingModels: Object.values(PlanPricingModel),
    visibilities: Object.values(PlanVisibility),
    sortFields: PLAN_CONSTANTS.SORT_FIELDS,

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidCode(value: unknown): value is PlanCode {
        return typeof value === "string" && this.codes.includes(value as PlanCode);
    },

    isValidType(value: unknown): value is PlanType {
        return typeof value === "string" && this.types.includes(value as PlanType);
    },

    isValidPricingModel(value: unknown): value is PlanPricingModel {
        return typeof value === "string" && this.pricingModels.includes(value as PlanPricingModel);
    },

    isValidVisibility(value: unknown): value is PlanVisibility {
        return typeof value === "string" && this.visibilities.includes(value as PlanVisibility);
    },

    isValidSortField(value: unknown): value is PlanSortField {
        return typeof value === "string" && this.sortFields.includes(value as PlanSortField);
    },

    normalizeName(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    },

    normalizeCode(value: string): PlanCode {
        return value.trim().toUpperCase() as PlanCode;
    },

    isPositiveInteger(value: unknown): boolean {
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0;
    },

    hasOnlyAllowedFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
        return Object.keys(body).every((field) => allowedFields.includes(field));
    },
};