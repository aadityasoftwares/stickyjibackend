import mongoose, { Schema } from "mongoose";

// The _id index exists even when application autoIndex is disabled.
const schema = new Schema(
    {
        _id: { type: String, required: true },
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { versionKey: false, collection: "subscriptionquotalocks" },
);

export const SubscriptionQuotaLockModel = mongoose.model("SubscriptionQuotaLock", schema);
