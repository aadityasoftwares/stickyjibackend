import { z } from "zod";
import { paginationShape } from "../../../utils/pagination.util.js";
import { listSortSchema } from "../../../utils/sorting.util.js";
import { PLAN_CONSTANTS } from "../constants/plan.constants.js";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../constants/plan.enums.js";

export const planListSchema = z
    .strictObject({
        ...paginationShape,
        status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE"),
        isActive: z.boolean().optional(),
        search: z.string().trim().max(PLAN_CONSTANTS.SEARCH.MAX_LENGTH).optional(),
        code: z.enum(PlanCode).optional(),
        type: z.enum(PlanType).optional(),
        pricingModel: z.enum(PlanPricingModel).optional(),
        visibility: z.enum(PlanVisibility).optional(),
        isPopular: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        isSystem: z.boolean().optional(),
        sortBy: z.union([listSortSchema, z.enum(PLAN_CONSTANTS.SORT_FIELDS)]).default("sortOrder"),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        currencyId: z.string().optional(),
        billingInterval: z.string().optional(),
    })
    .refine((value) => Number.isSafeInteger((value.page - 1) * value.limit), {
        path: ["page"],
        message: "Pagination offset exceeds the supported range.",
    });

export type PlanListFilters = z.infer<typeof planListSchema>;
