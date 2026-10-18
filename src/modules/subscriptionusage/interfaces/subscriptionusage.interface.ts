import type { Document, Types } from "mongoose";
import type { BillingScopeType, SubscriptionResource } from "../constants/subscriptionusage.enums.js";

export interface IBillingScope {
    type: BillingScopeType;
    id: string;
}

export interface IWorkspaceFolderUsage {
    workspaceId: string;
    foldersUsed: number;
}

export interface ISubscriptionUsage {
    scopeType: BillingScopeType;
    scopeId: Types.ObjectId;
    workspacesUsed: number;
    activeStickyNotesUsed: number;
    storageBytesUsed: number;
    usersUsed: number;
    lastCalculatedAt: Date;
    revision: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISubscriptionUsageDocument extends ISubscriptionUsage, Document {}

export interface ISubscriptionUsageSummary {
    scopeType: BillingScopeType;
    scopeId: string;
    workspacesUsed: number;
    activeStickyNotesUsed: number;
    storageBytesUsed: number;
    usersUsed: number;
    workspaceFolders?: IWorkspaceFolderUsage[];
    calculatedAt: Date;
    cached?: boolean;
}

export interface IWorkspaceScopedUsage {
    workspaceId: string;
    workspaceName: string;
    ownerId: string;
    isOwner: boolean;
    foldersUsed: number;
    activeStickyNotesUsed: number;
    storageBytesUsed: number;
    calculatedAt: Date;
}

export interface ISubscriptionUsageFilter {
    page?: number;
    limit?: number;
    search?: string;
    scopeType?: BillingScopeType;
    sortBy?: "workspacesUsed" | "activeStickyNotesUsed" | "storageBytesUsed" | "updatedAt" | "createdAt";
    sortOrder?: "asc" | "desc";
}

export interface IReconciliationScopeReport {
    scopeType: BillingScopeType;
    scopeId: string;
    status: "MATCHED" | "REPAIRED" | "ERROR";
    cached: {
        workspacesUsed: number;
        activeStickyNotesUsed: number;
        storageBytesUsed: number;
        usersUsed: number;
    };
    actual: {
        workspacesUsed: number;
        activeStickyNotesUsed: number;
        storageBytesUsed: number;
        usersUsed: number;
    };
    discrepancy: {
        workspacesDiff: number;
        activeStickyNotesDiff: number;
        storageBytesDiff: number;
        usersDiff: number;
    };
    repaired: boolean;
    error?: string;
}

export interface ISubscriptionUsageReconcileReport {
    totalProcessed: number;
    matchedCount: number;
    repairedCount: number;
    errorCount: number;
    dryRun: boolean;
    scopes: IReconciliationScopeReport[];
    executedAt: Date;
}

export interface IUsageReservation {
    resource: SubscriptionResource;
    amount: number;
    scope: IBillingScope;
    referenceId?: string;
}
