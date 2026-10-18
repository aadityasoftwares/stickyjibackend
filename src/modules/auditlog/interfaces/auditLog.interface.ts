import { Document, Types } from "mongoose";

import {
    AuditLogAction,
    AuditLogActorType,
    AuditLogSeverity,
    AuditLogStatus,
} from "../constants/auditLog.enums.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

export interface IAuditLogChange {
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
}

export interface IAuditLog {
    actorId?: Types.ObjectId | null;
    actorType: AuditLogActorType;
    action: AuditLogAction;
    module: AppModule;
    resourceType?: string | null;
    resourceId?: Types.ObjectId | string | null;
    resourceName?: string | null;
    description: string;
    status: AuditLogStatus;
    severity: AuditLogSeverity;
    changes?: IAuditLogChange[];
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IAuditLogFilter {
    page?: number;
    limit?: number;
    search?: string;
    module?: AppModule;
    action?: AuditLogAction;
    status?: AuditLogStatus;
    severity?: AuditLogSeverity;
    actorType?: AuditLogActorType;
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    workspaceId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IAuditLogContext {
    actorId?: Types.ObjectId | string | null;
    actorType?: AuditLogActorType;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
}

export interface IAuditLogCreateData
    extends Omit<Partial<IAuditLog>, "actorId"> {
    actorId?: Types.ObjectId | string | null;
    action: AuditLogAction;
    module: AppModule;
    description: string;
}

export interface IAuditLogResource {
    module: AppModule;
    resourceId?: Types.ObjectId | string | number | null;
    resourceName?: string | null;
}

export interface IAuditLogDocument extends IAuditLog, Document { }