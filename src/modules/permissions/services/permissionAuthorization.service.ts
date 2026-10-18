import { isWorkspaceTrashed, WorkspaceStatus } from "../../workspace/constants/workspace.enums.js";
import { Types } from "mongoose";
import { PermissionModel } from "../models/permission.model.js";
import { RoleModel } from "../../roles/models/role.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";
import { PermissionAccess, PermissionAction, PermissionModule } from "../constants/permission.enums.js";
import { PermissionMessages } from "../constants/permission.messages.js";
import { WorkspaceMemberMessages } from "../../workspaceMember/constants/workspaceMember.messages.js";
import { SYSTEM_ROLE_CODES, WORKSPACE_ROLE_PERMISSION_CODES, PROTECTED_SYSTEM_ROLE_CODES } from "../../roles/constants/role.constants.js";
import { RoleMessages } from "../../roles/constants/role.messages.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type { IPermissionDocument } from "../interfaces/permission.interface.js";
import { RoleScope } from "../../roles/constants/role.enums.js";
import { PermissionRepository } from "../repositories/permission.repository.js";

export interface IResolvedPermission {
    module: string;
    action: PermissionAction;
    access: PermissionAccess;
    code?: string;
    isActive: boolean;
}

export interface IWorkspaceAuthorizationContext {
    userId: string;
    workspaceId: string;
    isOwner: boolean;
    membershipId?: string | null;
    workspaceStatus?: WorkspaceStatus;
    membership?: {
        _id: Types.ObjectId;
        roleId?: Types.ObjectId | null;
        status: WorkspaceMemberStatus;
        joinedAt?: Date | null;
    } | null;
    role: {
        _id: Types.ObjectId;
        code: string;
        name: string;
        priority: number;
        scope: string;
        isSystem: boolean;
    };
    permissions: IResolvedPermission[];
}

export interface IGlobalAuthorizationContext {
    userId: string;
    permissions: IResolvedPermission[];
}

export class PermissionAuthorizationService {
    async resolveGlobalAuthorization(userId: string): Promise<IGlobalAuthorizationContext> {
        if (!Types.ObjectId.isValid(userId)) throw new AppError("Invalid authenticated user.", 401);
        const role = await new PermissionRepository().findUserGlobalRole(userId);

        if (!role) throw new AppError(PermissionMessages.FORBIDDEN, 403, "FORBIDDEN");
        return {
            userId, permissions: role.permissions.map(p => ({
                module: String(p.module).toUpperCase(), action: p.action, access: p.access,
                code: p.code, isActive: p.isActive !== false,
            }))
        };
    }
    /**
     * Resolves workspace membership, active role, and associated permissions.
     */
    async resolveWorkspaceAuthorization(
        userId: string,
        workspaceId: string,
        allowTrashed = false,
        allowInactive = false,
    ): Promise<IWorkspaceAuthorizationContext> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid authenticated user.", 401);
        }
        if (!Types.ObjectId.isValid(workspaceId)) {
            throw new AppError("Invalid workspace ID.", 400);
        }

        const workspace = await WorkspaceModel.findById(workspaceId)
            .select("_id ownerId createdBy status")
            .lean()
            .exec();

        if (!workspace) {
            throw new AppError(PermissionMessages.UNAUTHORIZED_WORKSPACE, 404);
        }
        const ownerIdStr = workspace.ownerId ? workspace.ownerId.toString() : "";
        const isOwner = ownerIdStr === userId;
        const auth = isOwner
            ? await this.resolveOwnerAuthorization(userId, workspaceId)
            : await this.resolveMemberAuthorization(userId, workspaceId);
        auth.workspaceStatus = workspace.status;
        this.assertWorkspaceState(workspace.status, allowTrashed, allowInactive);
        return auth;
    }

    assertWorkspaceState(status: WorkspaceStatus, allowTrashed = false, allowInactive = false): void {
        if (!allowTrashed && isWorkspaceTrashed(status)) {
            throw new AppError("Cannot perform this operation because the workspace has been deleted.", 400);
        }
        if (!allowInactive && [WorkspaceStatus.INACTIVE, WorkspaceStatus.SUSPENDED].includes(status)) {
            throw new AppError(PermissionMessages.WORKSPACE_INACTIVE, 403, "FORBIDDEN");
        }
    }

    /**
     * Resolves authorization for the workspace owner.
     */
    private async resolveOwnerAuthorization(
        userId: string,
        workspaceId: string,
    ): Promise<IWorkspaceAuthorizationContext> {
        const ownerRole = await RoleModel.findOne({
            code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER,
            isSystem: true,
            isActive: true,
            scope: RoleScope.WORKSPACE,
            workspaceId: null,
        })
            .populate<{ permissions: IPermissionDocument[] }>({
                path: "permissions",
                match: { isActive: true },
                select: "module action access code isActive",
            })
            .select("_id code name displayName priority scope permissions isSystem isActive")
            .lean()
            .exec();

        if (ownerRole && ownerRole.permissions?.length) {
            return {
                userId,
                workspaceId,
                isOwner: true,
                membershipId: null,
                role: {
                    _id: ownerRole._id,
                    code: ownerRole.code,
                    name: ownerRole.displayName || ownerRole.name || "Workspace Owner",
                    priority: ownerRole.priority ?? 100,
                    scope: ownerRole.scope,
                    isSystem: true,
                },
                permissions: ownerRole.permissions.map((p) => ({
                    module: String(p.module).toUpperCase(),
                    action: p.action,
                    access: p.access,
                    code: p.code,
                    isActive: p.isActive !== false,
                })),
            };
        }

        // Fallback for unseeded test environments: Owner has all owner permissions
        const fallbackPermissions = this.buildFallbackPermissions(WORKSPACE_ROLE_PERMISSION_CODES.OWNER);
        return {
            userId,
            workspaceId,
            isOwner: true,
            membershipId: null,
            role: {
                _id: new Types.ObjectId(),
                code: SYSTEM_ROLE_CODES.WORKSPACE_OWNER,
                name: "Workspace Owner",
                priority: 100,
                scope: "WORKSPACE",
                isSystem: true,
            },
            permissions: fallbackPermissions,
        };
    }

    /**
     * Resolves authorization for a standard workspace member.
     */
    private async resolveMemberAuthorization(
        userId: string,
        workspaceId: string,
    ): Promise<IWorkspaceAuthorizationContext> {
        const member = await WorkspaceMemberModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
            status: WorkspaceMemberStatus.ACTIVE,
        })
            .select("_id workspaceId userId roleId status joinedAt")
            .lean()
            .exec();

        if (!member) {
            throw new AppError(PermissionMessages.UNAUTHORIZED_WORKSPACE, 403, "FORBIDDEN");
        }

        let role = member.roleId
            ? await RoleModel.findOne({
                _id: member.roleId,
                code: { $ne: SYSTEM_ROLE_CODES.WORKSPACE_OWNER },
                isActive: true,
                scope: RoleScope.WORKSPACE,
                $or: [{ workspaceId: new Types.ObjectId(workspaceId) }, { workspaceId: null, isSystem: true }],
            })
                .populate<{ permissions: IPermissionDocument[] }>({
                    path: "permissions",
                    match: { isActive: true },
                    select: "module action access code isActive",
                })
                .select("_id code name displayName priority scope permissions isSystem isActive")
                .lean()
                .exec()
            : null;

        if (!role && member.roleId) {
            throw new AppError(PermissionMessages.ROLE_INACTIVE, 403, "ROLE_INACTIVE");
        }

        if (!role) {
            // Default to system workspace-member role if unassigned or in test environment
            role = await RoleModel.findOne({
                code: SYSTEM_ROLE_CODES.WORKSPACE_MEMBER,
                isSystem: true,
                isActive: true,
                scope: RoleScope.WORKSPACE,
                workspaceId: null,
            })
                .populate<{ permissions: IPermissionDocument[] }>({
                    path: "permissions",
                    match: { isActive: true },
                    select: "module action access code isActive",
                })
                .select("_id code name displayName priority scope permissions isSystem isActive")
                .lean()
                .exec();
        }

        if (role) {
            return {
                userId,
                workspaceId,
                isOwner: false,
                membershipId: member._id.toString(),
                membership: member,
                role: {
                    _id: role._id,
                    code: role.code,
                    name: role.displayName || role.name || "Workspace Member",
                    priority: role.priority ?? 50,
                    scope: role.scope,
                    isSystem: Boolean(role.isSystem),
                },
                permissions: role.permissions.map((p) => ({
                    module: String(p.module).toUpperCase(),
                    action: p.action,
                    access: p.access,
                    code: p.code,
                    isActive: p.isActive !== false,
                })),
            };
        }

        throw new AppError(PermissionMessages.ROLE_INACTIVE, 403, "ROLE_INACTIVE");
    }

    /**
     * Checks if the authorization context grants the requested permission.
     */
    checkPermission(
        auth: Pick<IWorkspaceAuthorizationContext, "permissions">,
        module: string,
        action: PermissionAction | PermissionAction[],
    ): { granted: boolean; access: PermissionAccess | null } {

        const targetModule = module.toUpperCase();
        const targetActions = Array.isArray(action) ? action : [action];

        const matching = auth.permissions.filter(
            (p) => p.isActive && p.module === targetModule && targetActions.includes(p.action),
        );

        if (matching.length === 0) {
            return { granted: false, access: null };
        }

        if (matching.some((p) => p.access === PermissionAccess.ANY)) {
            return { granted: true, access: PermissionAccess.ANY };
        }
        if (matching.some((p) => p.access === PermissionAccess.OWN)) {
            return { granted: true, access: PermissionAccess.OWN };
        }
        return { granted: true, access: PermissionAccess.GENERAL };
    }

    /**
     * Asserts that the authorization context contains the required permission.
     * Throws 403 Forbidden if not satisfied.
     */
    assertPermission(
        auth: Pick<IWorkspaceAuthorizationContext, "permissions">,
        module: string,
        action: PermissionAction | PermissionAction[],
        customMessage?: string,
    ): PermissionAccess {
        const { granted, access } = this.checkPermission(auth, module, action);
        if (!granted || !access) {
            throw new AppError(customMessage || PermissionMessages.FORBIDDEN, 403, "FORBIDDEN");
        }
        return access;
    }

    canAccessWorkspace(auth: Pick<IWorkspaceAuthorizationContext, "isOwner" | "permissions">, action: PermissionAction | PermissionAction[]): boolean {
        // Ownership is authoritative for workspace administration, independent of membership roles.
        if (auth.isOwner) return true;
        return this.checkPermission({ permissions: auth.permissions.filter(p => p.access !== PermissionAccess.OWN) },
            PermissionModule.WORKSPACE, action).granted;
    }

    assertWorkspaceAccess(auth: IWorkspaceAuthorizationContext, action: PermissionAction | PermissionAction[]): void {
        if (!this.canAccessWorkspace(auth, action)) {
            throw new AppError(PermissionMessages.UNAUTHORIZED_WORKSPACE, 403, "FORBIDDEN");
        }
    }

    canAccessFolder(auth: Pick<IWorkspaceAuthorizationContext, "isOwner" | "permissions">, action: PermissionAction | PermissionAction[]): boolean {
        if (!this.canAccessWorkspace(auth, PermissionAction.READ)) return false;
        if (auth.isOwner) return true;
        // Folders belong to the workspace; createdBy does not confer ownership.
        return this.checkPermission({ permissions: auth.permissions.filter(p => p.access !== PermissionAccess.OWN) },
            PermissionModule.FOLDERS, action).granted;
    }

    assertFolderAccess(auth: IWorkspaceAuthorizationContext, action: PermissionAction | PermissionAction[]): void {
        this.assertWorkspaceAccess(auth, PermissionAction.READ);
        if (!this.canAccessFolder(auth, action)) {
            throw new AppError(PermissionMessages.FORBIDDEN, 403, "FORBIDDEN");
        }
    }

    assertMemberAccess(auth: IWorkspaceAuthorizationContext, action: PermissionAction | PermissionAction[]): void {
        if (auth.isOwner) return;
        // Membership is scoped to a workspace, not ownership of individual member records.
        this.assertPermission({ permissions: auth.permissions.filter(p => p.access !== PermissionAccess.OWN) },
            PermissionModule.MEMBERS, action);
    }

    /**
     * Asserts permission and OWN / ANY resource access on a Sticky Note.
     */
    assertNoteAccess(
        auth: IWorkspaceAuthorizationContext,
        note: { createdBy?: unknown; workspaceId?: unknown },
        action: PermissionAction | PermissionAction[],
        customMessage?: string,
    ): PermissionAccess {
        const access = this.assertPermission(auth, PermissionModule.NOTES, action, customMessage);

        if (access === PermissionAccess.OWN) {
            const creatorId = this.extractId(note.createdBy);
            if (!creatorId || creatorId !== auth.userId) {
                throw new AppError(
                    customMessage || "You do not have permission to perform this action on this note.",
                    403,
                    "FORBIDDEN",
                );
            }
        }

        return access;
    }

    /**
     * Validates that the actor's role priority allows assigning the target role.
     * Actor cannot assign roles with equal or higher priority than their own (unless owner).
     */
    assertCanAssignRole(
        actorAuth: IWorkspaceAuthorizationContext,
        targetRole: { priority?: number; code?: string; isSystem?: boolean },
    ): void {
        if (actorAuth.isOwner) return;

        const actorPriority = actorAuth.role.priority ?? 0;
        const targetPriority = targetRole.priority ?? 0;

        if (targetPriority >= actorPriority) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_ASSIGN_HIGHER_ROLE, 403, "FORBIDDEN");
        }
    }

    /**
     * Validates that the actor's role priority allows managing/modifying the target member.
     * Actor cannot modify members with equal or higher role priority (unless owner).
     */
    assertCanManageMember(
        actorAuth: IWorkspaceAuthorizationContext,
        targetMemberRole: { priority?: number; code?: string },
    ): void {
        if (actorAuth.isOwner) return;

        const actorPriority = actorAuth.role.priority ?? 0;
        const targetPriority = targetMemberRole.priority ?? 0;

        if (targetPriority >= actorPriority) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_MANAGE_HIGHER_ROLE, 403, "FORBIDDEN");
        }
    }

    /**
     * Validates that the actor has permission to modify or delete the target role.
     * Enforces system-role protection, workspace boundaries, and role hierarchy.
     */
    assertCanManageRole(
        actorAuth: IWorkspaceAuthorizationContext,
        targetRole: { priority?: number; code?: string; isSystem?: boolean; workspaceId?: unknown },
    ): void {
        if (targetRole.isSystem || (targetRole.code && PROTECTED_SYSTEM_ROLE_CODES.has(targetRole.code))) {
            throw new AppError(RoleMessages.SYSTEM_ROLE_UPDATE, 403, "FORBIDDEN");
        }

        if (targetRole.workspaceId && String(targetRole.workspaceId) !== actorAuth.workspaceId) {
            throw new AppError(RoleMessages.WORKSPACE_MISMATCH, 403, "FORBIDDEN");
        }

        if (actorAuth.isOwner) return;

        const actorPriority = actorAuth.role.priority ?? 0;
        const targetPriority = targetRole.priority ?? 0;

        if (targetPriority >= actorPriority) {
            throw new AppError(RoleMessages.CANNOT_MODIFY_HIGHER_ROLE, 403, "FORBIDDEN");
        }
    }

    /**
     * Shared authoritative role-assignment validation path used by
     * Workspace Members, Workspace Invitations, and Role Management.
     */
    assertAssignableWorkspaceRole(
        role: { _id?: unknown; isActive?: boolean; scope?: string; code?: string; workspaceId?: unknown; isSystem?: boolean } | null,
        workspaceId: string,
        customMessage?: string,
    ): void {
        const notFoundMsg = customMessage || WorkspaceMemberMessages.ROLE_NOT_FOUND;
        const notAllowedMsg = customMessage || WorkspaceMemberMessages.ROLE_NOT_ALLOWED;
        if (!role) {
            throw new AppError(notFoundMsg, 404);
        }
        if (!role.isActive || role.scope !== RoleScope.WORKSPACE || role.code === SYSTEM_ROLE_CODES.WORKSPACE_OWNER) {
            throw new AppError(notAllowedMsg, 400);
        }
        if (role.isSystem) {
            if (role.workspaceId !== null && role.workspaceId !== undefined) {
                throw new AppError(notAllowedMsg, 400);
            }
            return;
        }
        const roleWorkspace = role.workspaceId;
        const roleWorkspaceId = roleWorkspace && typeof roleWorkspace === "object" && "_id" in roleWorkspace
            ? String((roleWorkspace as { _id: unknown })._id)
            : roleWorkspace ? String(roleWorkspace) : null;
        if (!roleWorkspaceId || roleWorkspaceId !== workspaceId) {
            throw new AppError(notAllowedMsg, 400);
        }
    }

    private extractId(value: unknown): string {
        if (!value) return "";
        if (typeof value === "object" && "_id" in value) {
            return String((value as { _id: unknown })._id);
        }
        return String(value);
    }

    private buildFallbackPermissions(codes: readonly string[]): IResolvedPermission[] {
        const codeSet = new Set(codes);
        const permissions: IResolvedPermission[] = [];

        for (const code of codeSet) {
            const [modulePart, ...rest] = code.split("_");
            const actionPart = rest[0];
            const accessPart = rest[1];

            let action = PermissionAction.READ;
            if (actionPart === "CREATE") action = PermissionAction.CREATE;
            else if (actionPart === "UPDATE") action = PermissionAction.UPDATE;
            else if (actionPart === "DELETE") action = PermissionAction.DELETE;
            else if (actionPart === "INVITE") action = PermissionAction.INVITE;
            else if (actionPart === "ASSIGN") action = PermissionAction.ASSIGN;
            else if (actionPart === "REMOVE") action = PermissionAction.REMOVE;
            else if (actionPart === "ARCHIVE") action = PermissionAction.ARCHIVE;
            else if (actionPart === "MOVE") action = PermissionAction.MOVE;
            else if (actionPart === "SHARE") action = PermissionAction.SHARE;
            else if (actionPart === "SETTINGS") action = PermissionAction.SETTINGS;
            else if (actionPart === "TRANSFER") action = PermissionAction.TRANSFER;

            let access = PermissionAccess.GENERAL;
            if (accessPart === "OWN") access = PermissionAccess.OWN;
            else if (accessPart === "ANY") access = PermissionAccess.ANY;

            permissions.push({
                module: modulePart.toUpperCase(),
                action,
                access,
                code,
                isActive: true,
            });
        }

        return permissions;
    }
}

export const permissionAuthorizationService = new PermissionAuthorizationService();
