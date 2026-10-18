import { z } from "zod";

export const verifyCheckoutCallbackSchema = z.object({
    checkoutIntentId: z.string().min(1, "checkoutIntentId is required."),
    razorpayPaymentId: z.string().min(1, "razorpayPaymentId is required."),
    razorpaySubscriptionId: z.string().min(1, "razorpaySubscriptionId is required."),
    razorpaySignature: z.string().min(1, "razorpaySignature is required."),
});

export type VerifyCheckoutCallbackInput = z.infer<typeof verifyCheckoutCallbackSchema>;
