import { Types } from "mongoose";
import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { permissionAuthorizationService, type IWorkspaceAuthorizationContext, type IGlobalAuthorizationContext } from "../../permissions/services/permissionAuthorization.service.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogChange, IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import type {
    IRole,
    IRoleCreateInput,
    IRoleFilter,
    IRoleResponse,
    IRoleUpdateInput,
} from "../interfaces/role.interface.js";
import { RoleRepository } from "../repositories/role.repository.js";
import { PermissionModel } from "../../permissions/models/permission.model.js";
import { RoleMessages } from "../constants/role.messages.js";
import {
    PROTECTED_SYSTEM_ROLE_CODES,
    SYSTEM_ROLE_CODES,
} from "../constants/role.constants.js";
import { PERMISSION_CODES } from "../../permissions/constants/permission.constants.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { RoleScope, RoleType } from "../constants/role.enums.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";

const OWNER_ONLY_PERMISSIONS = new Set<string>([
    PERMISSION_CODES.WORKSPACE_TRANSFER_OWNERSHIP,
    PERMISSION_CODES.WORKSPACE_DELETE,
]);

export class RoleService {
    private readonly roleRepository: RoleRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.roleRepository = new RoleRepository();
        this.auditLogService = new AuditLogService();
    }

    private toResponse(role: any): IRoleResponse {
        if (!role) return null as any;
        const id = role._id ? role._id.toString() : (role.id ? role.id.toString() : "");
        const raw = typeof role.toObject === "function" ? role.toObject() : { ...role };

        const permissions = Array.isArray(raw.permissions)
            ? raw.permissions.map((p: any) => {
                if (!p) return p;
                if (typeof p === "object" && (p._id || p.id)) {
                    const pId = p._id ? p._id.toString() : p.id.toString();
                    const pRaw = typeof p.toObject === "function" ? p.toObject() : { ...p };
                    return {
                        ...pRaw,
                        id: pId,
                        _id: pId,
                    };
                }
                return p.toString();
            })
            : raw.permissions;

        return {
            ...raw,
            id,
            _id: id,
            workspaceId: raw.workspaceId ? raw.workspaceId.toString() : (raw.workspaceId ?? null),
            createdBy: raw.createdBy ? raw.createdBy.toString() : (raw.createdBy ?? null),
            updatedBy: raw.updatedBy ? raw.updatedBy.toString() : (raw.updatedBy ?? null),
            permissions,
        };
    }


    async createRole(
        data: IRoleCreateInput,
        userId: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!userId || !Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid authenticated user.", 401);
        }

        const scope = data.scope ?? RoleScope.WORKSPACE;

        if (scope !== RoleScope.WORKSPACE) {
            throw new AppError(RoleMessages.CUSTOM_ROLE_ONLY, 400);
        }

        if (!data.workspaceId) {
            throw new AppError(RoleMessages.WORKSPACE_REQUIRED, 400);
        }

        const workspaceIdString = String(data.workspaceId);
        if (!Types.ObjectId.isValid(workspaceIdString)) {
            throw new AppError(RoleMessages.INVALID_WORKSPACE, 400);
        }

        await workspaceAvailabilityService.assertAvailable(workspaceIdString);

        const auth = (authorization && authorization.workspaceId === workspaceIdString)
            ? authorization
            : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceIdString);

        permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.CREATE);

        const name = StringHelper.normalize(data.name).toLowerCase();
        const displayName = StringHelper.normalize(data.displayName);
        const code = StringHelper.normalizeUpper(data.code);
        const description = StringHelper.normalizeOptional(data.description) ?? "";

        if (
            PROTECTED_SYSTEM_ROLE_CODES.has(code) ||
            Object.values(SYSTEM_ROLE_CODES).includes(code as any)
        ) {
            throw new AppError(RoleMessages.PROTECTED_CODE, 403);
        }

        const requestedPriority = data.priority !== undefined ? Number(data.priority) : 0;
        if (isNaN(requestedPriority) || requestedPriority < 0) {
            throw new AppError("Invalid role priority.", 400);
        }

        if (!auth.isOwner && requestedPriority >= (auth.role.priority ?? 0)) {
            throw new AppError(RoleMessages.CANNOT_CREATE_HIGHER_PRIORITY, 403);
        }

        const codeExists = await this.roleRepository.existsByCode(code, workspaceIdString);
        if (codeExists) {
            throw new AppError(RoleMessages.ALREADY_EXISTS, 409);
        }

        const nameExists = await this.roleRepository.existsByName(name, workspaceIdString);
        if (nameExists) {
            throw new AppError(RoleMessages.ALREADY_EXISTS, 409);
        }

        const permissions = await this.preparePermissions(data.permissions ?? [], auth);

        const payload: Partial<IRole> = {
            name,
            displayName,
            code,
            description,
            type: RoleType.CUSTOM,
            scope: RoleScope.WORKSPACE,
            workspaceId: new Types.ObjectId(workspaceIdString),
            permissions,
            isSystem: false,
            isDefault: false,
            priority: requestedPriority,
            isActive: data.isActive ?? true,
            createdBy: new Types.ObjectId(userId),
            updatedBy: new Types.ObjectId(userId),
        };

        const role = await this.roleRepository.create(payload);
        if (!role) {
            throw new AppError("Failed to create role.", 500);
        }

        try {
            await this.auditLogService.logCreate(
                context ?? { actorId: userId },
                {
                    module: AppModule.ROLE,
                    resourceId: role._id.toString(),
                    resourceName: role.displayName || role.name,
                },
                `Role "${role.displayName || role.name}" was created successfully.`,
                workspaceIdString ? { workspaceId: workspaceIdString } : undefined,
            );
        } catch (error) {
            await this.roleRepository.deleteById(role._id.toString());
            throw error;
        }

        return this.toResponse(role);
    }

    async getRoleById(
        id: string,
        userId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        const role = await this.roleRepository.findById(id);
        if (!role) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        if (role.workspaceId) {
            const workspaceIdString = role.workspaceId.toString();
            await workspaceAvailabilityService.assertAvailable(workspaceIdString);
            const auth = (authorization && authorization.workspaceId === workspaceIdString)
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceIdString, true, true);
            permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.READ);
        }

        return this.toResponse(role);
    }

    async getRoleByCode(
        code: string,
        workspaceId?: string,
        userId?: string,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        const normalizedCode = StringHelper.normalizeUpper(code);
        let role;

        if (workspaceId) {
            if (!Types.ObjectId.isValid(workspaceId)) {
                throw new AppError(RoleMessages.INVALID_WORKSPACE, 400);
            }
            await workspaceAvailabilityService.assertAvailable(workspaceId);

            if (userId) {
                const auth = (authorization && authorization.workspaceId === workspaceId)
                    ? authorization
                    : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceId, true, true);
                permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.READ);
            }

            role = await this.roleRepository.findByCode(normalizedCode, workspaceId);
            if (!role) {
                role = await this.roleRepository.findSystemRoleByCode(normalizedCode);
            }
        } else {
            role = await this.roleRepository.findSystemRoleByCode(normalizedCode);
        }

        if (!role) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        return this.toResponse(role);
    }

    async getRoles(
        filters: IRoleFilter = {},
        userId: string,
        authorization?: IWorkspaceAuthorizationContext | IGlobalAuthorizationContext,
    ) {
        if (filters.workspaceId) {
            if (!Types.ObjectId.isValid(filters.workspaceId)) {
                throw new AppError(RoleMessages.INVALID_WORKSPACE, 400);
            }
            await workspaceAvailabilityService.assertAvailable(filters.workspaceId);

            const auth = (authorization && "workspaceId" in authorization && authorization.workspaceId === filters.workspaceId)
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, filters.workspaceId, true, true);

            permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.READ);
        } else {
            const auth = (authorization && !("workspaceId" in authorization))
                ? authorization
                : await permissionAuthorizationService.resolveGlobalAuthorization(userId);

            permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.READ);
        }

        const result = await this.roleRepository.findAll(filters);
        return {
            data: result.data.map(r => this.toResponse(r)),
            pagination: result.pagination,
        };
    }

    async updateRole(
        id: string,
        data: IRoleUpdateInput,
        userId: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        const role = await this.roleRepository.findById(id);
        if (!role) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        if (role.isSystem) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_UPDATE, 403);
        }

        if (!role.workspaceId) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_UPDATE, 403);
        }

        const workspaceIdString = role.workspaceId.toString();
        await workspaceAvailabilityService.assertAvailable(workspaceIdString);

        const auth = (authorization && authorization.workspaceId === workspaceIdString)
            ? authorization
            : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceIdString);

        permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.UPDATE);
        permissionAuthorizationService.assertCanManageRole(auth, role);

        // Prevent self-escalation: member cannot edit the role they are assigned to
        if (!auth.isOwner && auth.role._id.toString() === role._id.toString()) {
            throw new AppError(RoleMessages.CANNOT_MODIFY_SELF_ROLE, 403);
        }

        const payload: Partial<IRole> = {
            updatedBy: new Types.ObjectId(userId),
        };
        const changes: IAuditLogChange[] = [];

        if (data.name !== undefined) {
            const normalizedName = StringHelper.normalize(data.name).toLowerCase();
            if (normalizedName !== role.name) {
                const nameExists = await this.roleRepository.existsByName(normalizedName, workspaceIdString, id);
                if (nameExists) {
                    throw new AppError(RoleMessages.ALREADY_EXISTS, 409);
                }
                payload.name = normalizedName;
                changes.push({ field: "name", oldValue: role.name, newValue: normalizedName });
            }
        }

        if (data.displayName !== undefined) {
            const normalizedDisplayName = StringHelper.normalize(data.displayName);
            if (normalizedDisplayName !== role.displayName) {
                payload.displayName = normalizedDisplayName;
                changes.push({ field: "displayName", oldValue: role.displayName, newValue: normalizedDisplayName });
            }
        }

        if (data.code !== undefined) {
            const normalizedCode = StringHelper.normalizeUpper(data.code);
            if (normalizedCode !== role.code) {
                if (
                    PROTECTED_SYSTEM_ROLE_CODES.has(normalizedCode) ||
                    Object.values(SYSTEM_ROLE_CODES).includes(normalizedCode as any)
                ) {
                    throw new AppError(RoleMessages.PROTECTED_CODE, 403);
                }
                const codeExists = await this.roleRepository.existsByCode(normalizedCode, workspaceIdString, id);
                if (codeExists) {
                    throw new AppError(RoleMessages.ALREADY_EXISTS, 409);
                }
                payload.code = normalizedCode;
                changes.push({ field: "code", oldValue: role.code, newValue: normalizedCode });
            }
        }

        if (data.description !== undefined) {
            const normalizedDescription = StringHelper.normalizeOptional(data.description) ?? "";
            if (normalizedDescription !== (role.description ?? "")) {
                payload.description = normalizedDescription;
                changes.push({ field: "description", oldValue: role.description ?? "", newValue: normalizedDescription });
            }
        }

        if (data.permissions !== undefined) {
            const newPermissions = await this.preparePermissions(data.permissions, auth);
            const oldIds = new Set((role.permissions ?? []).map(p => (typeof p === "object" && "_id" in p ? String(p._id) : String(p))));
            const newIds = new Set(newPermissions.map(p => p.toString()));

            const hasChanged = oldIds.size !== newIds.size || [...newIds].some(id => !oldIds.has(id));
            if (hasChanged) {
                payload.permissions = newPermissions;
                changes.push({
                    field: "permissions",
                    oldValue: Array.from(oldIds),
                    newValue: Array.from(newIds),
                });
            }
        }

        if (data.isActive !== undefined && data.isActive !== role.isActive) {
            if (role.isDefault && !data.isActive) {
                throw new AppError(RoleMessages.DEFAULT_ROLE_DEACTIVATE, 400);
            }
            payload.isActive = data.isActive;
            changes.push({ field: "isActive", oldValue: role.isActive, newValue: data.isActive });
        }

        if (changes.length === 0) {
            return this.toResponse(role);
        }

        const originalRoleSnapshot = {
            name: role.name,
            displayName: role.displayName,
            code: role.code,
            description: role.description,
            permissions: (role.permissions ?? []).map(p => (typeof p === "object" && "_id" in p ? new Types.ObjectId(String(p._id)) : new Types.ObjectId(String(p)))),
            isActive: role.isActive,
            updatedBy: role.updatedBy,
        };

        const updatedRole = await this.roleRepository.updateById(id, payload);
        if (!updatedRole) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logUpdate(
                context ?? { actorId: userId },
                {
                    module: AppModule.ROLE,
                    resourceId: id,
                    resourceName: updatedRole.displayName || updatedRole.name,
                },
                `Role "${updatedRole.displayName || updatedRole.name}" was updated.`,
                changes,
                workspaceIdString ? { workspaceId: workspaceIdString } : undefined,
            );
        } catch (error) {
            await this.roleRepository.updateById(id, originalRoleSnapshot);
            throw error;
        }

        return this.toResponse(updatedRole);
    }

    async changeRoleStatus(
        id: string,
        isActive: boolean,
        userId: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        const role = await this.roleRepository.findById(id);
        if (!role) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        if (role.isSystem) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_UPDATE, 403);
        }

        if (role.isDefault && !isActive) {
            throw new AppError(RoleMessages.DEFAULT_ROLE_DEACTIVATE, 400);
        }

        if (!role.workspaceId) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_UPDATE, 403);
        }

        const workspaceIdString = role.workspaceId.toString();
        await workspaceAvailabilityService.assertAvailable(workspaceIdString);

        const auth = (authorization && authorization.workspaceId === workspaceIdString)
            ? authorization
            : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceIdString);

        permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.UPDATE);
        permissionAuthorizationService.assertCanManageRole(auth, role);

        if (!auth.isOwner && auth.role._id.toString() === role._id.toString()) {
            throw new AppError(RoleMessages.CANNOT_MODIFY_SELF_ROLE, 403);
        }

        if (role.isActive === isActive) {
            return this.toResponse(role);
        }

        const updatedRole = await this.roleRepository.updateById(id, {
            isActive,
            updatedBy: new Types.ObjectId(userId),
        });

        if (!updatedRole) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logStatusChange(
                context ?? { actorId: userId },
                {
                    module: AppModule.ROLE,
                    resourceId: id,
                    resourceName: updatedRole.displayName || updatedRole.name,
                },
                "isActive",
                role.isActive,
                isActive,
                `Role "${updatedRole.displayName || updatedRole.name}" status changed to ${isActive ? "active" : "inactive"}.`,
                workspaceIdString ? { workspaceId: workspaceIdString } : undefined,
            );
        } catch (error) {
            await this.roleRepository.updateById(id, { isActive: role.isActive, updatedBy: role.updatedBy });
            throw error;
        }

        return this.toResponse(updatedRole);
    }

    async deleteRole(
        id: string,
        userId: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        const role = await this.roleRepository.findById(id);
        if (!role) {
            throw new AppError(RoleMessages.NOT_FOUND, 404);
        }

        if (role.isSystem) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_DELETE, 403);
        }

        if (role.isDefault) {
            throw new AppError(RoleMessages.DEFAULT_ROLE_DELETE, 403);
        }

        if (!role.workspaceId) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_DELETE, 403);
        }

        const workspaceIdString = role.workspaceId.toString();
        await workspaceAvailabilityService.assertAvailable(workspaceIdString);

        const auth = (authorization && authorization.workspaceId === workspaceIdString)
            ? authorization
            : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceIdString);

        permissionAuthorizationService.assertPermission(auth, PermissionModule.ROLES, PermissionAction.DELETE);
        permissionAuthorizationService.assertCanManageRole(auth, role);

        if (!auth.isOwner && auth.role._id.toString() === role._id.toString()) {
            throw new AppError(RoleMessages.CANNOT_MODIFY_SELF_ROLE, 403);
        }

        const assignedMembers = await this.roleRepository.countAssignedMembers(id);
        if (assignedMembers > 0) {
            throw new AppError(RoleMessages.ROLE_IN_USE, 409);
        }

        const pendingInvitations = await this.roleRepository.countPendingInvitations(id);
        if (pendingInvitations > 0) {
            throw new AppError(RoleMessages.ROLE_HAS_INVITATIONS, 409);
        }

        await this.roleRepository.deleteById(id);

        try {
            await this.auditLogService.logDelete(
                context ?? { actorId: userId },
                {
                    module: AppModule.ROLE,
                    resourceId: id,
                    resourceName: role.displayName || role.name,
                },
                `Role "${role.displayName || role.name}" was deleted successfully.`,
                workspaceIdString ? { workspaceId: workspaceIdString } : undefined,
            );
        } catch {
            // Fail-open for post-deletion audit; the role was already verified free of references
        }

        return true;
    }

    private async preparePermissions(
        permissions: Array<string | Types.ObjectId>,
        actorAuth?: IWorkspaceAuthorizationContext,
    ): Promise<Types.ObjectId[]> {
        if (!permissions || permissions.length === 0) {
            return [];
        }

        const rawIds = permissions.map(p => (typeof p === "object" && "_id" in p ? String(p._id) : String(p)));
        const uniqueIds = Array.from(new Set(rawIds));

        for (const pid of uniqueIds) {
            if (!Types.ObjectId.isValid(pid)) {
                throw new AppError(RoleMessages.INVALID_PERMISSION, 400);
            }
        }

        const validPermissions = await PermissionModel.find({
            _id: { $in: uniqueIds.map(id => new Types.ObjectId(id)) },
            isActive: true,
        })
            .select("_id code module action access isActive")
            .lean()
            .exec();

        if (validPermissions.length !== uniqueIds.length) {
            throw new AppError(RoleMessages.INVALID_PERMISSION, 400);
        }

        // Privilege escalation prevention:
        // Actor cannot grant permissions they themselves do not possess (unless owner)
        if (actorAuth && !actorAuth.isOwner) {
            const actorCodes = new Set(actorAuth.permissions.map(p => p.code));
            for (const p of validPermissions) {
                if (OWNER_ONLY_PERMISSIONS.has(p.code)) {
                    throw new AppError(RoleMessages.CANNOT_GRANT_OWNER_PERMISSIONS, 403);
                }
                if (!actorCodes.has(p.code)) {
                    throw new AppError(RoleMessages.CANNOT_GRANT_UNOWNED_PERMISSIONS, 403);
                }
            }
        } else {
            // Even an owner cannot assign owner-only transfer/purge permissions to arbitrary custom roles
            for (const p of validPermissions) {
                if (OWNER_ONLY_PERMISSIONS.has(p.code)) {
                    throw new AppError(RoleMessages.CANNOT_GRANT_OWNER_PERMISSIONS, 403);
                }
            }
        }

        return validPermissions.map(p => new Types.ObjectId(p._id.toString()));
    }
}
