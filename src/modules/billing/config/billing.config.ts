import dotenv from "dotenv";
import { BillingEnvironment, BillingProviderName } from "../constants/billing.enums.js";
dotenv.config();

export interface IBillingConfig {
    provider: BillingProviderName;
    environment: BillingEnvironment;
    razorpay: {
        keyId: string;
        keySecret: string;
        webhookSecret: string;
    };
}

export function getBillingConfig(): IBillingConfig {
    const environment = (process.env.RAZORPAY_MODE === "live" ? BillingEnvironment.LIVE : BillingEnvironment.TEST);
    const provider = BillingProviderName.RAZORPAY;

    return {
        provider,
        environment,
        razorpay: {
            keyId: process.env.RAZORPAY_KEY_ID || "",
            keySecret: process.env.RAZORPAY_KEY_SECRET || "",
            webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
        },
    };
}

export function assertRazorpayConfigured(): { keyId: string; keySecret: string; webhookSecret: string } {
    const config = getBillingConfig();
    if (!config.razorpay.keyId || !config.razorpay.keySecret) {
        throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.");
    }
    return config.razorpay;
}
