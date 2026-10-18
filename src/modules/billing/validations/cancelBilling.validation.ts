import { z } from "zod";

export const cancelBillingSchema = z.object({
    reason: z.string().max(250, "Cancellation reason cannot exceed 250 characters.").optional(),
    immediate: z.boolean().optional().default(false),
});

export type CancelBillingInput = z.input<typeof cancelBillingSchema>;
export type CancelBillingOutput = z.output<typeof cancelBillingSchema>;
