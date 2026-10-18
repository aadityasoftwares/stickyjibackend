import { z } from "zod";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { SubscriptionEntitlementMessages } from "../constants/subscriptionentitlement.messages.js";

export const entitlementObjectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, SubscriptionEntitlementMessages.INVALID_USER_ID);
export const entitlementWorkspaceIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID);

const booleanField = z.union([
    z.boolean(),
    z.string().trim().toLowerCase().transform(v => v === "true"),
]);

export const getSubscriptionEntitlementsSchema = z.strictObject({
    fresh: booleanField.optional(),
});

export const checkSubscriptionEntitlementSchema = z.strictObject({
    resourceCode: z.nativeEnum(FeatureCode, {
        message: SubscriptionEntitlementMessages.INVALID_RESOURCE,
    }),
    requestedAmount: z.union([z.number(), z.string().trim().transform(Number)])
        .pipe(z.number().int().positive().max(1000000000000))
        .default(1),
    workspaceId: entitlementWorkspaceIdSchema.optional(),
    fileSize: z.union([z.number(), z.string().trim().transform(Number)])
        .pipe(z.number().int().positive().max(1000000000000))
        .optional(),
});

export const getWorkspaceFolderEntitlementsSchema = z.strictObject({
    workspaceId: entitlementWorkspaceIdSchema,
});

export type GetSubscriptionEntitlementsInput = z.infer<typeof getSubscriptionEntitlementsSchema>;
export type CheckSubscriptionEntitlementInput = z.infer<typeof checkSubscriptionEntitlementSchema>;
export type GetWorkspaceFolderEntitlementsInput = z.infer<typeof getWorkspaceFolderEntitlementsSchema>;
