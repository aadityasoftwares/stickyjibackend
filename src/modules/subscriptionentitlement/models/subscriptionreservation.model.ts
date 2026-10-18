import mongoose, { Schema } from "mongoose";
import { BillingScopeType } from "../../subscriptionusage/constants/subscriptionusage.enums.js";
import { ReservationStatus } from "../constants/subscriptionentitlement.enums.js";
import { SUBSCRIPTION_ENTITLEMENT_CONSTANTS } from "../constants/subscriptionentitlement.constants.js";
import type { ISubscriptionReservationDocument } from "../interfaces/subscriptionentitlement.interface.js";

const SubscriptionReservationSchema = new Schema<ISubscriptionReservationDocument>(
    {
        operationId: {
            type: String,
            trim: true,
            index: {
                unique: true,
                sparse: true,
            },
        },
        scopeType: {
            type: String,
            enum: Object.values(BillingScopeType),
            required: true,
            default: BillingScopeType.USER,
        },
        scopeId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            default: null,
            index: true,
        },
        resource: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        status: {
            type: String,
            enum: Object.values(ReservationStatus),
            required: true,
            default: ReservationStatus.PENDING,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: {
                expireAfterSeconds: 0,
            },
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        collection: SUBSCRIPTION_ENTITLEMENT_CONSTANTS.COLLECTION_NAME,
    },
);

// Compound indexes for high-throughput concurrency checks
SubscriptionReservationSchema.index({ scopeType: 1, scopeId: 1, resource: 1, status: 1 });
SubscriptionReservationSchema.index({ workspaceId: 1, resource: 1, status: 1 });

export const SubscriptionReservationModel = mongoose.model<ISubscriptionReservationDocument>(
    "SubscriptionReservation",
    SubscriptionReservationSchema,
);
