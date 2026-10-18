import { Types } from "mongoose";
import type {
    IPermission,
    IPermissionCreateInput,
    IPermissionFilter,
    IPermissionResponse,
    IPermissionUpdateInput,
} from "../interfaces/permission.interface.js";
import { PermissionRepository } from "../repositories/permission.repository.js";
import { PermissionMessages } from "../constants/permission.messages.js";
import { PermissionAccess } from "../constants/permission.enums.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { RoleModel } from "../../roles/models/role.model.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogChange, IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";

export class PermissionService {
    private readonly permissionRepository: PermissionRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.permissionRepository = new PermissionRepository();
        this.auditLogService = new AuditLogService();
    }

    private toResponse(permission: any): IPermissionResponse {
        if (!permission) return null as any;
        const id = permission._id ? permission._id.toString() : (permission.id ? permission.id.toString() : "");
        const raw = typeof permission.toObject === "function" ? permission.toObject() : { ...permission };

        return {
            ...raw,
            id,
            _id: id,
            createdBy: raw.createdBy ? raw.createdBy.toString() : (raw.createdBy ?? null),
            updatedBy: raw.updatedBy ? raw.updatedBy.toString() : (raw.updatedBy ?? null),
        };
    }


    async createPermission(
        data: IPermissionCreateInput,
        userId?: string,
        context?: IAuditLogContext,
    ) {
        const name = StringHelper.normalize(data.name).toLowerCase();
        const displayName = StringHelper.normalize(data.displayName);
        const code = StringHelper.normalizeUpper(data.code);
        const module = StringHelper.normalizeUpper(data.module);
        const description = StringHelper.normalizeOptional(data.description) ?? "";
        const access = data.access ?? PermissionAccess.GENERAL;

        const existingCode = await this.permissionRepository.findByCode(code);
        if (existingCode) {
            throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
        }

        const existingName = await this.permissionRepository.findByName(name);
        if (existingName) {
            throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
        }

        const existingCombination = await this.permissionRepository.findByCombination(
            module,
            data.action,
            access,
        );
        if (existingCombination) {
            throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
        }

        const payload: Partial<IPermission> = {
            name,
            displayName,
            code,
            module,
            action: data.action,
            access,
            description,
            sortOrder: data.sortOrder ?? 0,
            isSystem: false,
            isActive: data.isActive ?? true,
            createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null,
            updatedBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null,
        };

        const permission = await this.permissionRepository.create(payload);
        if (!permission) {
            throw new AppError("Failed to create permission.", 500);
        }

        try {
            await this.auditLogService.logCreate(
                context ?? { actorId: userId ?? null },
                {
                    module: AppModule.PERMISSION,
                    resourceId: permission._id.toString(),
                    resourceName: permission.displayName || permission.name,
                },
                `Permission "${permission.displayName || permission.name}" was created.`,
            );
        } catch (error) {
            await this.permissionRepository.deleteById(permission._id.toString());
            throw error;
        }

        return this.toResponse(permission);
    }

    async getPermissionById(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        const permission = await this.permissionRepository.findById(id);
        if (!permission) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        return this.toResponse(permission);
    }

    async getPermissionByCode(code: string) {
        const permission = await this.permissionRepository.findByCode(
            StringHelper.normalizeUpper(code),
        );

        if (!permission) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        return this.toResponse(permission);
    }

    async getPermissions(filters: IPermissionFilter = {}) {
        const result = await this.permissionRepository.findAll(filters);
        return {
            data: result.data.map((p) => this.toResponse(p)),
            pagination: result.pagination,
        };
    }

    async getGroupedPermissions() {
        const permissions = await this.permissionRepository.findForRoleBuilder();
        const grouped = new Map<string, { module: string; permissions: IPermissionResponse[] }>();

        for (const permission of permissions) {
            if (!grouped.has(permission.module)) {
                grouped.set(permission.module, {
                    module: permission.module,
                    permissions: [],
                });
            }
            grouped.get(permission.module)!.permissions.push(this.toResponse(permission));
        }

        return Array.from(grouped.values());
    }

    async updatePermission(
        id: string,
        data: IPermissionUpdateInput,
        userId?: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        const permission = await this.permissionRepository.findById(id);
        if (!permission) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        if (permission.isSystem) {
            throw new AppError(PermissionMessages.SYSTEM_PERMISSION_UPDATE, 403);
        }

        const payload: Partial<IPermission> = {
            updatedBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null,
        };
        const changes: IAuditLogChange[] = [];

        if (data.name !== undefined) {
            const name = StringHelper.normalize(data.name).toLowerCase();
            if (name !== permission.name) {
                const existing = await this.permissionRepository.existsByName(name, id);
                if (existing) {
                    throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
                }
                payload.name = name;
                changes.push({ field: "name", oldValue: permission.name, newValue: name });
            }
        }

        if (data.displayName !== undefined) {
            const displayName = StringHelper.normalize(data.displayName);
            if (displayName !== permission.displayName) {
                payload.displayName = displayName;
                changes.push({ field: "displayName", oldValue: permission.displayName, newValue: displayName });
            }
        }

        if (data.code !== undefined) {
            const code = StringHelper.normalizeUpper(data.code);
            if (code !== permission.code) {
                const existing = await this.permissionRepository.existsByCode(code, id);
                if (existing) {
                    throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
                }
                payload.code = code;
                changes.push({ field: "code", oldValue: permission.code, newValue: code });
            }
        }

        if (data.module !== undefined) {
            const module = StringHelper.normalizeUpper(data.module);
            if (module !== permission.module) {
                payload.module = module;
                changes.push({ field: "module", oldValue: permission.module, newValue: module });
            }
        }

        if (data.action !== undefined && data.action !== permission.action) {
            payload.action = data.action;
            changes.push({ field: "action", oldValue: permission.action, newValue: data.action });
        }

        if (data.access !== undefined && data.access !== permission.access) {
            payload.access = data.access;
            changes.push({ field: "access", oldValue: permission.access, newValue: data.access });
        }

        const effectiveModule = payload.module ?? permission.module;
        const effectiveAction = payload.action ?? permission.action;
        const effectiveAccess = payload.access ?? permission.access;

        if (
            payload.module !== undefined ||
            payload.action !== undefined ||
            payload.access !== undefined
        ) {
            const combination = await this.permissionRepository.findByCombination(
                effectiveModule,
                effectiveAction,
                effectiveAccess,
            );
            if (combination && combination._id.toString() !== id) {
                throw new AppError(PermissionMessages.ALREADY_EXISTS, 409);
            }
        }

        if (data.description !== undefined) {
            const description = StringHelper.normalizeOptional(data.description) ?? "";
            if (description !== (permission.description ?? "")) {
                payload.description = description;
                changes.push({ field: "description", oldValue: permission.description ?? "", newValue: description });
            }
        }

        if (data.sortOrder !== undefined && data.sortOrder !== permission.sortOrder) {
            payload.sortOrder = data.sortOrder;
            changes.push({ field: "sortOrder", oldValue: permission.sortOrder, newValue: data.sortOrder });
        }

        if (data.isActive !== undefined && data.isActive !== permission.isActive) {
            payload.isActive = data.isActive;
            changes.push({ field: "isActive", oldValue: permission.isActive, newValue: data.isActive });
        }

        if (changes.length === 0) {
            return this.toResponse(permission);
        }

        const updated = await this.permissionRepository.updateById(id, payload);
        if (!updated) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logUpdate(
                context ?? { actorId: userId ?? null },
                {
                    module: AppModule.PERMISSION,
                    resourceId: id,
                    resourceName: updated.displayName || updated.name,
                },
                `Permission "${updated.displayName || updated.name}" was updated.`,
                changes,
            );
        } catch {
            // Revert changes on audit failure
            await this.permissionRepository.updateById(id, {
                name: permission.name,
                displayName: permission.displayName,
                code: permission.code,
                module: permission.module,
                action: permission.action,
                access: permission.access,
                description: permission.description,
                sortOrder: permission.sortOrder,
                isActive: permission.isActive,
                updatedBy: permission.updatedBy,
            });
            throw new AppError("Audit log failed. Permission update rolled back.", 500);
        }

        return this.toResponse(updated);
    }

    async changePermissionStatus(
        id: string,
        isActive: boolean,
        userId?: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        const permission = await this.permissionRepository.findById(id);
        if (!permission) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        if (permission.isSystem) {
            throw new AppError(PermissionMessages.SYSTEM_PERMISSION_UPDATE, 403);
        }

        if (permission.isActive === isActive) {
            return this.toResponse(permission);
        }

        const updated = await this.permissionRepository.updateById(id, {
            isActive,
            updatedBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null,
        });

        if (!updated) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logStatusChange(
                context ?? { actorId: userId ?? null },
                {
                    module: AppModule.PERMISSION,
                    resourceId: id,
                    resourceName: updated.displayName || updated.name,
                },
                "isActive",
                permission.isActive,
                isActive,
                `Permission "${updated.displayName || updated.name}" status changed to ${isActive ? "active" : "inactive"}.`,
            );
        } catch {
            await this.permissionRepository.updateById(id, {
                isActive: permission.isActive,
                updatedBy: permission.updatedBy,
            });
            throw new AppError("Audit log failed. Permission status change rolled back.", 500);
        }

        return this.toResponse(updated);
    }

    async deletePermission(
        id: string,
        userId?: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        const permission = await this.permissionRepository.findById(id);
        if (!permission) {
            throw new AppError(PermissionMessages.NOT_FOUND, 404);
        }

        if (permission.isSystem) {
            throw new AppError(PermissionMessages.SYSTEM_PERMISSION_DELETE, 403);
        }

        const roleUsingPermission = await RoleModel.exists({
            permissions: new Types.ObjectId(id),
        });

        if (roleUsingPermission) {
            throw new AppError(PermissionMessages.PERMISSION_IN_USE, 409);
        }

        await this.permissionRepository.deleteById(id);

        try {
            await this.auditLogService.logDelete(
                context ?? { actorId: userId ?? null },
                {
                    module: AppModule.PERMISSION,
                    resourceId: id,
                    resourceName: permission.displayName || permission.name,
                },
                `Permission "${permission.displayName || permission.name}" was deleted.`,
            );
        } catch {
            // Fail-open for post-deletion audit
        }

        return true;
    }
}