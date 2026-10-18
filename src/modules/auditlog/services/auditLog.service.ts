import { Types, type ClientSession } from "mongoose";
import type { Request } from "express";

import { AuditLogRepository } from "../repositories/auditLog.repository.js";
import type {
    IAuditLog,
    IAuditLogChange,
    IAuditLogContext,
    IAuditLogCreateData,
    IAuditLogFilter,
    IAuditLogResource,
} from "../interfaces/auditLog.interface.js";

import {
    AuditLogAction,
    AuditLogActorType,
    AuditLogSeverity,
    AuditLogStatus,
} from "../constants/auditLog.enums.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogConfig } from "../../../config/auditlog.config.js";

export class AuditLogService {
    private auditLogRepository: AuditLogRepository;

    constructor() {
        this.auditLogRepository = new AuditLogRepository();
    }

    async log(data: IAuditLogCreateData) {
        const config = this.getModuleConfig(data.module);

        this.validateAction(data.module, data.action);

        return this.auditLogRepository.create({
            ...data,
            actorId: this.toObjectId(data.actorId),
            resourceType: data.resourceType ?? config.resourceType,
            status: data.status ?? AuditLogStatus.SUCCESS,
            severity: data.severity ?? AuditLogSeverity.INFO,
            changes: data.changes ?? [],
            metadata: data.metadata ?? {},
        });
    }

    async logMany(logs: IAuditLogCreateData[], session?: ClientSession) {
        if (!logs.length) {
            return [];
        }

        const auditLogs = logs.map((log) => {
            const config = this.getModuleConfig(log.module);

            this.validateAction(log.module, log.action);

            return {
                ...log,
                actorId: this.toObjectId(log.actorId),
                resourceType: log.resourceType ?? config.resourceType,
                status: log.status ?? AuditLogStatus.SUCCESS,
                severity: log.severity ?? AuditLogSeverity.INFO,
                changes: log.changes ?? [],
                metadata: log.metadata ?? {},
            };
        });

        return this.auditLogRepository.createMany(auditLogs, session);
    }

    async logFromRequest(
        req: Request,
        data: Omit<IAuditLogCreateData, "actorId" | "ipAddress" | "userAgent" | "requestId">,
    ) {
        const context = this.getRequestContext(req);

        return this.log({
            ...data,
            actorId: context.actorId,
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            requestId: context.requestId,
        });
    }

    async logCreate(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.CREATE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logUpdate(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        changes: IAuditLogChange[],
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.UPDATE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            changes,
            metadata,
        });
    }

    async logDelete(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.DELETE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.WARNING,
            metadata,
        });
    }

    async logRestore(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.RESTORE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logStatusChange(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        field: string,
        oldValue: unknown,
        newValue: unknown,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.STATUS_CHANGE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            changes: [
                {
                    field,
                    oldValue: this.sanitizeValue(field, oldValue),
                    newValue: this.sanitizeValue(field, newValue),
                },
            ],
            metadata,
        });
    }

    async logLogin(
        context: IAuditLogContext,
        description = "User logged in successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.LOGIN,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logLogout(
        context: IAuditLogContext,
        description = "User logged out successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.LOGOUT,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logLoginFailed(
        context: IAuditLogContext,
        description = "User login failed.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.LOGIN_FAILED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.FAILURE,
            severity: AuditLogSeverity.WARNING,
            metadata,
        });
    }

    async logPasswordChanged(
        context: IAuditLogContext,
        description = "User password changed successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.PASSWORD_CHANGED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logPasswordReset(
        context: IAuditLogContext,
        description = "User password was reset successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.PASSWORD_RESET,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logEmailVerified(
        context: IAuditLogContext,
        description = "User email was verified successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.EMAIL_VERIFIED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logPhoneVerified(
        context: IAuditLogContext,
        description = "User phone was verified successfully.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.PHONE_VERIFIED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logMfaEnabled(
        context: IAuditLogContext,
        description = "Multi-factor authentication was enabled.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.MFA_ENABLED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logMfaDisabled(
        context: IAuditLogContext,
        description = "Multi-factor authentication was disabled.",
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.MFA_DISABLED,
            module: AppModule.USER,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.WARNING,
            metadata,
        });
    }

    async logAssign(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.ASSIGN,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logRemove(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.REMOVE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logRoleAssigned(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.ROLE_ASSIGNED,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logPermissionAssigned(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.PERMISSION_ASSIGNED,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logPermissionRevoked(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.PERMISSION_REVOKED,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.WARNING,
            metadata,
        });
    }

    async logSettingsUpdated(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        changes?: IAuditLogChange[],
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.SETTINGS_UPDATED,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            changes,
            metadata,
        });
    }

    async logImport(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.IMPORT,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logExport(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.EXPORT,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logArchive(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.ARCHIVE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.WARNING,
            metadata,
        });
    }

    async logRestoreArchive(
        context: IAuditLogContext,
        resource: IAuditLogResource,
        description: string,
        metadata?: Record<string, unknown>,
    ) {
        return this.log({
            ...context,
            action: AuditLogAction.RESTORE_ARCHIVE,
            module: resource.module,
            resourceType: this.getResourceType(resource.module),
            resourceId: (resource.resourceId as any) ?? null,
            resourceName: resource.resourceName ?? null,
            description,
            status: AuditLogStatus.SUCCESS,
            severity: AuditLogSeverity.INFO,
            metadata,
        });
    }

    async logSecurityEvent(
        context: IAuditLogContext,
        data: {
            action: AuditLogAction;
            module?: AppModule;
            resourceId?: string | number | null;
            resourceName?: string | null;
            description: string;
            status?: AuditLogStatus;
            severity?: AuditLogSeverity;
            changes?: IAuditLogChange[];
            metadata?: Record<string, unknown>;
        },
    ) {
        const module = data.module ?? AppModule.USER;

        return this.log({
            ...context,
            action: data.action,
            module,
            resourceType: this.getResourceType(module),
            resourceId: (data.resourceId as any) ?? null,
            resourceName: data.resourceName ?? null,
            description: data.description,
            status: data.status ?? AuditLogStatus.FAILURE,
            severity: data.severity ?? AuditLogSeverity.WARNING,
            changes: data.changes,
            metadata: data.metadata,
        });
    }

    async getById(id: string) {
        const auditLog = await this.auditLogRepository.findById(id);

        if (!auditLog) {
            throw new AppError("Audit log not found.", 404);
        }

        return auditLog;
    }

    async getAll(filters: IAuditLogFilter = {}) {
        return this.auditLogRepository.findAll(filters);
    }

    private getModuleConfig(module: AppModule) {
        const config = AuditLogConfig[module];

        if (!config) {
            throw new AppError(`Audit log configuration not found for module: ${module}`, 400);
        }

        return config;
    }

    private getResourceType(module: AppModule): string {
        return this.getModuleConfig(module).resourceType;
    }

    private validateAction(module: AppModule, action: AuditLogAction): void {
        const config = this.getModuleConfig(module);

        if (!config.actions.includes(action)) {
            throw new AppError(`Action ${action} is not allowed for module ${module}.`, 400);
        }
    }

    private toObjectId(id?: Types.ObjectId | string | null): Types.ObjectId | null {
        if (!id) {
            return null;
        }

        if (id instanceof Types.ObjectId) {
            return id;
        }

        if (!Types.ObjectId.isValid(id)) {
            throw new AppError("Invalid audit log actor ID.", 400);
        }

        return new Types.ObjectId(id);
    }

    private getRequestContext(req: Request): IAuditLogContext {
        const user = req.user as
            | {
                  _id?: string;
                  id?: string;
                  actorType?: AuditLogActorType;
              }
            | undefined;

        const requestId = req.headers["x-request-id"]?.toString() ?? null;

        const forwardedFor = req.headers["x-forwarded-for"]?.toString();

        const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? req.ip ?? null;

        return {
            actorId: user?._id?.toString() ?? user?.id?.toString() ?? null,
            actorType: user?.actorType ?? AuditLogActorType.USER,
            ipAddress,
            userAgent: req.get("user-agent") ?? null,
            requestId,
        };
    }

    private sanitizeValue(field: string, value: unknown): unknown {
        const sensitiveFields = [
            "password",
            "currentPassword",
            "newPassword",
            "confirmPassword",
            "token",
            "accessToken",
            "refreshToken",
            "apiKey",
            "secret",
            "secretKey",
            "otp",
            "authorization",
            "mfaSecret",
            "passwordResetToken",
            "passwordResetTokenHash",
            "emailVerificationToken",
            "emailVerificationTokenHash",
        ];

        if (sensitiveFields.includes(field)) {
            return "[REDACTED]";
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        return value;
    }
}
