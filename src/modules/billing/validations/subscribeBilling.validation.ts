import { z } from "zod";

export const subscribeBillingSchema = z.object({
    planPriceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid planPriceId format."),
});

export type SubscribeBillingInput = z.infer<typeof subscribeBillingSchema>;
