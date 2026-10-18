import type { Document, Types } from "mongoose";
import type { BillingScopeType } from "../../subscriptionusage/constants/subscriptionusage.enums.js";
import type { IBillingScope } from "../../subscriptionusage/interfaces/subscriptionusage.interface.js";
import type { EntitlementDecisionReason, ReservationStatus } from "../constants/subscriptionentitlement.enums.js";

export interface IEntitlementDecision {
    allowed: boolean;
    resourceCode: string;
    currentUsage: number;
    limit: number;
    requestedAmount: number;
    remaining: number;
    reason: EntitlementDecisionReason;
    message?: string;
}

export interface IResourceEntitlementSummary {
    limit: number;
    used?: number;
    remaining?: number;
    isUnlimited?: boolean;
}

export interface IPlanEntitlementSummary {
    planCode: string;
    planName: string;
    accessState: string;
    resources: Record<string, IResourceEntitlementSummary>;
    subscriptionId?: string | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
}

export interface ISubscriptionReservation {
    operationId?: string | null;
    scopeType: BillingScopeType;
    scopeId: Types.ObjectId;
    workspaceId?: Types.ObjectId | null;
    resource: string;
    amount: number;
    status: ReservationStatus;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISubscriptionReservationDocument extends ISubscriptionReservation, Document {
    _id: Types.ObjectId;
}

export interface ICheckEntitlementInput {
    resourceCode: string;
    requestedAmount?: number;
    workspaceId?: string;
    fileSize?: number;
}

export interface IPlanLimitValue {
    limit: number;
    isUnlimited: boolean;
    isEnabled: boolean;
}

export type PlanLimitsMap = Record<string, IPlanLimitValue>;

export interface IReservationResult {
    reservationId: string;
    operationId?: string | null;
    resource: string;
    amount: number;
    expiresAt: Date;
}
