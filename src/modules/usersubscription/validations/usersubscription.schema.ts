import { z } from "zod";
import { BillingInterval } from "../../planprice/constants/planPrice.enums.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";
import { UserSubscriptionStatus } from "../constants/usersubscription.enums.js";
import { UserSubscriptionMessages } from "../constants/usersubscription.messages.js";
import { paginationShape } from "../../../utils/pagination.util.js";

export const subscriptionObjectIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, UserSubscriptionMessages.INVALID_ID);

const listShape = {
    ...paginationShape,
    plan: subscriptionObjectIdSchema.optional(),
    status: z.enum(UserSubscriptionStatus).optional(),
    search: z.string().trim().max(USER_SUBSCRIPTION_CONSTANTS.SEARCH_MAX_LENGTH).optional(),
    sortBy: z
        .enum(USER_SUBSCRIPTION_CONSTANTS.SORT_FIELDS)
        .default(USER_SUBSCRIPTION_CONSTANTS.DEFAULT_SORT_BY),
    sortOrder: z.enum(["asc", "desc"]).default(USER_SUBSCRIPTION_CONSTANTS.DEFAULT_SORT_ORDER),
};
const validOffset = (value: { page: number; limit: number }) =>
    Number.isSafeInteger((value.page - 1) * value.limit);

export const userSubscriptionsSchema = z.strictObject(listShape).refine(validOffset, { path: ["page"] });
export const adminSubscriptionsSchema = z
    .strictObject({
        ...listShape,
        user: subscriptionObjectIdSchema.optional(),
    })
    .refine(validOffset, { path: ["page"] });

export const changeSubscriptionPlanSchema = z.strictObject({
    plan: subscriptionObjectIdSchema,
    planPriceId: subscriptionObjectIdSchema.optional(),
    billingInterval: z.enum(BillingInterval).optional(),
});
export const cancelSubscriptionSchema = z.strictObject({
    reason: z.string().trim().min(1).max(USER_SUBSCRIPTION_CONSTANTS.REASON_MAX_LENGTH).optional(),
});
export const emptySubscriptionSchema = z.strictObject({});
export const reconcileSubscriptionsSchema = z.strictObject({
    reason: z.string().trim().min(1).max(USER_SUBSCRIPTION_CONSTANTS.REASON_MAX_LENGTH),
    batchSize: z
        .number()
        .int()
        .min(1)
        .max(USER_SUBSCRIPTION_CONSTANTS.MAX_BATCH_SIZE)
        .default(USER_SUBSCRIPTION_CONSTANTS.RECONCILE_BATCH_SIZE),
    afterId: subscriptionObjectIdSchema.optional(),
});

export type UserSubscriptionFilters = z.infer<typeof userSubscriptionsSchema>;
export type AdminSubscriptionFilters = z.infer<typeof adminSubscriptionsSchema>;
