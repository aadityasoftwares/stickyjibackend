import { z } from "zod";

export const changePlanBillingSchema = z
    .object({
        targetPlanPriceId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, "Invalid targetPlanPriceId format.")
            .optional(),
        targetPlanId: z
            .string()
            .regex(/^[0-9a-fA-F]{24}$/, "Invalid targetPlanId format.")
            .optional(),
    })
    .refine((data) => data.targetPlanPriceId || data.targetPlanId, {
        message: "Either targetPlanPriceId or targetPlanId must be provided.",
    });

export type ChangePlanBillingInput = z.infer<typeof changePlanBillingSchema>;
