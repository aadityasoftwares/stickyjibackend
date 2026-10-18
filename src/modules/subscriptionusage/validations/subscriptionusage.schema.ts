import { z } from "zod";
import { BillingScopeType } from "../constants/subscriptionusage.enums.js";
import { SUBSCRIPTION_USAGE_CONSTANTS } from "../constants/subscriptionusage.constants.js";
import { SubscriptionUsageMessages } from "../constants/subscriptionusage.messages.js";
import { paginationShape } from "../../../utils/pagination.util.js";

export const usageObjectIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, SubscriptionUsageMessages.INVALID_USER_ID);
export const workspaceObjectIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, SubscriptionUsageMessages.INVALID_WORKSPACE_ID);

const booleanField = z.union([
    z.boolean(),
    z
        .string()
        .trim()
        .toLowerCase()
        .transform((v) => v === "true"),
]);

export const getSubscriptionUsageSchema = z.strictObject({
    fresh: booleanField.optional(),
    includeFolders: booleanField.optional(),
});

export const getWorkspaceUsageSchema = z.strictObject({
    workspaceId: workspaceObjectIdSchema,
});

const validOffset = (value: { page: number; limit: number }) =>
    Number.isSafeInteger((value.page - 1) * value.limit);

export const subscriptionUsageListSchema = z
    .strictObject({
        ...paginationShape,
        search: z.string().trim().max(100).optional(),
        scopeType: z.enum(BillingScopeType).optional(),
        sortBy: z
            .enum(SUBSCRIPTION_USAGE_CONSTANTS.ALLOWED_SORT_FIELDS)
            .default(SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_SORT_BY),
        sortOrder: z.enum(["asc", "desc"]).default(SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_SORT_ORDER),
    })
    .refine(validOffset, { path: ["page"] });

export const reconcileSubscriptionUsageSchema = z.strictObject({
    scopeId: usageObjectIdSchema.optional(),
    scopeType: z.enum(BillingScopeType).default(BillingScopeType.USER).optional(),
    batchSize: z
        .union([z.number(), z.string().trim().transform(Number)])
        .pipe(z.number().int().min(1).max(SUBSCRIPTION_USAGE_CONSTANTS.RECONCILIATION_BATCH_MAX))
        .default(SUBSCRIPTION_USAGE_CONSTANTS.RECONCILIATION_BATCH_DEFAULT),
    dryRun: booleanField.optional(),
    reason: z.string().trim().max(500).optional(),
});

export type GetSubscriptionUsageInput = z.infer<typeof getSubscriptionUsageSchema>;
export type SubscriptionUsageListFilters = z.infer<typeof subscriptionUsageListSchema>;
export type ReconcileSubscriptionUsageInput = z.infer<typeof reconcileSubscriptionUsageSchema>;
