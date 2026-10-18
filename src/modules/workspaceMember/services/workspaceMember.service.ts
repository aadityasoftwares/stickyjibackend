import { Types } from "mongoose";

import type {
    IWorkspaceMember,
    IWorkspaceMemberCreate,
    IWorkspaceMemberFilter,
    IWorkspaceMemberListItem,
    IWorkspaceMemberListResult,
    IWorkspaceMemberUpdate,
} from "../interfaces/workspaceMember.interface.js";

import { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";
import { WorkspaceMemberMessages } from "../constants/workspaceMember.messages.js";
import { WorkspaceMemberRepository } from "../repositories/workspaceMember.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";

import { RoleScope } from "../../roles/constants/role.enums.js";
import { SYSTEM_ROLE_CODES } from "../../roles/constants/role.constants.js";
import {
    createWorkspaceMemberSchema,
    updateWorkspaceMemberSchema,
    workspaceMemberListSchema,
} from "../validations/workspaceMember.schema.js";

import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import {
    permissionAuthorizationService,
    type IWorkspaceAuthorizationContext,
} from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction } from "../../permissions/constants/permission.enums.js";

interface AssignableRole {
    _id: Types.ObjectId;
    code?: string;
    scope?: RoleScope;
    workspaceId?: Types.ObjectId | null;
    isSystem?: boolean;
    isActive?: boolean;
    priority?: number;
}

export class WorkspaceMemberService {
    private readonly workspaceMemberRepository: WorkspaceMemberRepository;

    private readonly workspaceRepository: WorkspaceRepository;

    private readonly auditLogService: AuditLogService;

    constructor() {
        this.workspaceMemberRepository = new WorkspaceMemberRepository();

        this.workspaceRepository = new WorkspaceRepository();

        this.auditLogService = new AuditLogService();
    }

    async createWorkspaceMember(
        data: IWorkspaceMemberCreate,
        createdBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        const parsed = createWorkspaceMemberSchema.safeParse(data);
        if (!parsed.success) throw new AppError(WorkspaceMemberMessages.UNSUPPORTED_CREATE_FIELDS, 400);
        data = parsed.data;
        const actorAuth = await this.authorizeMember(
            createdBy,
            data.workspaceId,
            PermissionAction.INVITE,
            authorization,
        );
        const [workspace, userExists, existingMember, role] = await Promise.all([
            this.workspaceRepository.findById(data.workspaceId),

            this.workspaceMemberRepository.userExists(data.userId),

            this.workspaceMemberRepository.findMembershipIdentity(data.workspaceId, data.userId),

            this.workspaceMemberRepository.findRoleById(data.roleId),
        ]);

        if (!workspace) {
            throw new AppError(WorkspaceMemberMessages.WORKSPACE_NOT_FOUND, 404);
        }

        if (workspace.isPersonal) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_ADD_MEMBERS_TO_PERSONAL_WORKSPACE, 400);
        }

        if (!userExists) {
            throw new AppError(WorkspaceMemberMessages.USER_NOT_FOUND, 404);
        }

        if (existingMember) {
            throw new AppError(WorkspaceMemberMessages.ALREADY_EXISTS, 409);
        }

        if (this.extractObjectId(workspace.ownerId) === data.userId) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_ADD_OWNER, 409);
        }

        this.assertAssignableWorkspaceRole(role, data.workspaceId);

        permissionAuthorizationService.assertCanAssignRole(actorAuth, role);

        const actorId = new Types.ObjectId(createdBy);

        const memberData: Partial<IWorkspaceMember> = {
            workspaceId: new Types.ObjectId(data.workspaceId),
            userId: new Types.ObjectId(data.userId),
            roleId: new Types.ObjectId(data.roleId),
            status: WorkspaceMemberStatus.ACTIVE,
            invitedBy: actorId,
            joinedAt: new Date(),
            createdBy: actorId,
            updatedBy: actorId,
        };

        let member;
        try {
            member = await this.workspaceMemberRepository.create(memberData);
        } catch (error) {
            if (this.isDuplicateKeyError(error))
                throw new AppError(WorkspaceMemberMessages.ALREADY_EXISTS, 409);
            throw error;
        }

        if (!member) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 500);
        }

        try {
            await this.auditLogService.log({
                ...context,
                actorId: createdBy,
                action: AuditLogAction.ASSIGN,
                module: AppModule.WORKSPACE_MEMBER,
                resourceId: member._id,
                resourceName: "Workspace Member",
                description: `User was added to workspace ${workspace.name}.`,
                metadata: { workspaceId: data.workspaceId, userId: data.userId, roleId: data.roleId },
            });
        } catch (error) {
            await this.workspaceMemberRepository.hardDeleteById(member._id.toString());
            throw error;
        }

        return member;
    }

    async getWorkspaceMemberById(
        id: string,
        requesterUserId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 400);
        const member = await this.workspaceMemberRepository.findById(id);

        if (!member) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 404);
        }

        await this.authorizeMember(
            requesterUserId,
            this.extractObjectId(member.workspaceId),
            PermissionAction.READ,
            authorization,
        );

        return member;
    }

    async getWorkspaceMembers(
        filtersOrUserId: IWorkspaceMemberFilter | string,
        requesterUserIdOrFilters: string | IWorkspaceMemberFilter,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceMemberListResult> {
        let filters: IWorkspaceMemberFilter;
        let requesterUserId: string;

        if (typeof filtersOrUserId === "string") {
            requesterUserId = filtersOrUserId;
            filters = (requesterUserIdOrFilters as IWorkspaceMemberFilter) ?? {};
        } else {
            filters = filtersOrUserId ?? {};
            requesterUserId = requesterUserIdOrFilters as string;
        }

        const parsed = workspaceMemberListSchema.safeParse(filters);
        if (!parsed.success) {
            throw new AppError(
                parsed.error.issues[0]?.message ?? WorkspaceMemberMessages.INVALID_WORKSPACE_ID,
                400,
            );
        }
        filters = parsed.data;
        const workspaceId = filters.workspaceId?.trim();

        if (!workspaceId) {
            throw new AppError(WorkspaceMemberMessages.WORKSPACE_ID_REQUIRED, 400);
        }

        if (!Types.ObjectId.isValid(workspaceId)) {
            throw new AppError(WorkspaceMemberMessages.INVALID_WORKSPACE_ID, 400);
        }

        if (!Types.ObjectId.isValid(requesterUserId)) {
            throw new AppError(WorkspaceMemberMessages.ACCESS_DENIED, 403);
        }

        await this.authorizeMember(requesterUserId, workspaceId, PermissionAction.READ, authorization);
        const workspace = await this.workspaceRepository.findById(workspaceId);

        if (!workspace) {
            throw new AppError(WorkspaceMemberMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const ownerId = this.extractObjectId(workspace.ownerId);

        const result = await this.workspaceMemberRepository.findAllForList({
            ...filters,
            workspaceId,
        });

        return {
            data: result.data.map((row) => this.toWorkspaceMemberListItem(row, ownerId, requesterUserId)),
            pagination: result.pagination,
        };
    }

    async updateWorkspaceMember(
        id: string,
        data: IWorkspaceMemberUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        const parsed = updateWorkspaceMemberSchema.safeParse(data);
        if (!parsed.success) {
            throw new AppError(WorkspaceMemberMessages.UPDATE_REQUIRED, 400);
        }

        return this.assignRole(id, parsed.data.roleId, updatedBy, context, authorization);
    }

    async assignRole(
        id: string,
        roleId: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(roleId)) {
            throw new AppError(WorkspaceMemberMessages.INVALID_ROLE_ID, 400);
        }
        const member = await this.workspaceMemberRepository.findById(id);

        if (!member) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 404);
        }

        const workspaceId = this.extractObjectId(member.workspaceId);

        if (this.isOwnerMember(member)) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_CHANGE_OWNER_ROLE, 400);
        }
        if (member.status !== WorkspaceMemberStatus.ACTIVE) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_UPDATE_STATUS, 400);
        }

        const role = await this.workspaceMemberRepository.findRoleById(roleId);

        this.assertAssignableWorkspaceRole(role, workspaceId);

        const actorAuth = await this.authorizeMember(
            updatedBy,
            workspaceId,
            PermissionAction.ASSIGN,
            authorization,
        );
        const targetMemberRole = await this.workspaceMemberRepository.findRoleById(
            this.extractObjectId(member.roleId),
        );
        if (!targetMemberRole) throw new AppError(WorkspaceMemberMessages.ROLE_NOT_ALLOWED, 400);
        permissionAuthorizationService.assertCanManageMember(actorAuth, targetMemberRole);
        permissionAuthorizationService.assertCanAssignRole(actorAuth, role);

        if (this.extractObjectId(member.roleId) === roleId) {
            return member;
        }

        const oldRoleId = this.extractObjectId(member.roleId);

        const updatedMember = await this.workspaceMemberRepository.updateRole(
            id,
            new Types.ObjectId(roleId),
            new Types.ObjectId(updatedBy),
            new Types.ObjectId(oldRoleId),
        );

        if (!updatedMember) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 409);
        }

        try {
            await this.auditLogService.log({
                ...context,
                actorId: updatedBy,
                action: AuditLogAction.ROLE_ASSIGNED,
                module: AppModule.WORKSPACE_MEMBER,
                resourceId: member._id,
                resourceName: "Workspace Member",
                description: `Workspace member role was changed from ${oldRoleId} to ${roleId}.`,
                metadata: { workspaceId, userId: this.extractObjectId(member.userId) },
                changes: [{ field: "roleId", oldValue: oldRoleId, newValue: roleId }],
            });
        } catch (error) {
            await this.workspaceMemberRepository.updateRole(
                id,
                new Types.ObjectId(oldRoleId),
                this.originalActorId(member.updatedBy),
                new Types.ObjectId(roleId),
            );
            throw error;
        }

        return updatedMember;
    }

    async removeWorkspaceMember(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 400);
        const member = await this.workspaceMemberRepository.findById(id);

        if (!member) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 404);
        }

        if (this.isOwnerMember(member)) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_REMOVE_OWNER, 400);
        }

        if (this.extractObjectId(member.userId) === updatedBy) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_REMOVE_SELF, 400);
        }

        const workspaceId = this.extractObjectId(member.workspaceId);
        const actorAuth = await this.authorizeMember(
            updatedBy,
            workspaceId,
            PermissionAction.REMOVE,
            authorization,
        );
        const targetMemberRole = await this.workspaceMemberRepository.findRoleById(
            this.extractObjectId(member.roleId),
        );
        if (!targetMemberRole) throw new AppError(WorkspaceMemberMessages.ROLE_NOT_ALLOWED, 400);
        permissionAuthorizationService.assertCanManageMember(actorAuth, targetMemberRole);

        if (member.status === WorkspaceMemberStatus.REMOVED) {
            return member;
        }

        const removedMember = await this.workspaceMemberRepository.remove(
            id,
            new Types.ObjectId(updatedBy),
            member.status,
            new Types.ObjectId(this.extractObjectId(member.roleId)),
        );

        if (!removedMember) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 409);
        }

        try {
            await this.auditLogService.log({
                ...context,
                actorId: updatedBy,
                action: AuditLogAction.REMOVE,
                module: AppModule.WORKSPACE_MEMBER,
                resourceId: member._id,
                resourceName: "Workspace Member",
                description: "Workspace member was removed successfully.",
                metadata: { workspaceId, userId: this.extractObjectId(member.userId) },
                changes: [
                    { field: "status", oldValue: member.status, newValue: WorkspaceMemberStatus.REMOVED },
                ],
            });
        } catch (error) {
            await this.workspaceMemberRepository.updateStatus(
                id,
                member.status,
                this.originalActorId(member.updatedBy),
                WorkspaceMemberStatus.REMOVED,
                new Types.ObjectId(this.extractObjectId(member.roleId)),
            );
            throw error;
        }

        return removedMember;
    }

    async restoreWorkspaceMember(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 400);
        const member = await this.workspaceMemberRepository.findByIdIncludingRemoved(id);

        if (!member) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 404);
        }

        if (this.isOwnerMember(member))
            throw new AppError(WorkspaceMemberMessages.CANNOT_CHANGE_OWNER_ROLE, 400);
        const workspaceId = this.extractObjectId(member.workspaceId);
        const actorAuth = await this.authorizeMember(
            updatedBy,
            workspaceId,
            [PermissionAction.ASSIGN, PermissionAction.INVITE],
            authorization,
        );
        const targetMemberRole = await this.workspaceMemberRepository.findRoleById(
            this.extractObjectId(member.roleId),
        );
        this.assertAssignableWorkspaceRole(targetMemberRole, workspaceId);
        permissionAuthorizationService.assertCanManageMember(actorAuth, targetMemberRole);
        permissionAuthorizationService.assertCanAssignRole(actorAuth, targetMemberRole);

        if (member.status === WorkspaceMemberStatus.ACTIVE) {
            return member;
        }
        if (member.status !== WorkspaceMemberStatus.REMOVED) {
            throw new AppError(WorkspaceMemberMessages.CANNOT_UPDATE_STATUS, 400);
        }

        const restoredMember = await this.workspaceMemberRepository.restore(
            id,
            new Types.ObjectId(updatedBy),
            new Types.ObjectId(this.extractObjectId(member.roleId)),
        );

        if (!restoredMember) {
            throw new AppError(WorkspaceMemberMessages.NOT_FOUND, 409);
        }

        try {
            await this.auditLogService.log({
                ...context,
                actorId: updatedBy,
                action: AuditLogAction.RESTORE,
                module: AppModule.WORKSPACE_MEMBER,
                resourceId: member._id,
                resourceName: "Workspace Member",
                description: "Workspace member was restored successfully.",
                metadata: { workspaceId, userId: this.extractObjectId(member.userId) },
                changes: [
                    {
                        field: "status",
                        oldValue: WorkspaceMemberStatus.REMOVED,
                        newValue: WorkspaceMemberStatus.ACTIVE,
                    },
                ],
            });
        } catch (error) {
            await this.workspaceMemberRepository.updateStatus(
                id,
                WorkspaceMemberStatus.REMOVED,
                this.originalActorId(member.updatedBy),
                WorkspaceMemberStatus.ACTIVE,
                new Types.ObjectId(this.extractObjectId(member.roleId)),
            );
            throw error;
        }

        return restoredMember;
    }

    private async authorizeMember(
        userId: string,
        workspaceId: string,
        action: PermissionAction | PermissionAction[],
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceAuthorizationContext> {
        if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(workspaceId)) {
            throw new AppError(WorkspaceMemberMessages.ACCESS_DENIED, 403);
        }
        if (authorization && (authorization.userId !== userId || authorization.workspaceId !== workspaceId)) {
            throw new AppError(WorkspaceMemberMessages.ACCESS_DENIED, 403);
        }
        const auth =
            authorization?.workspaceStatus !== undefined
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceId);
        permissionAuthorizationService.assertWorkspaceState(auth.workspaceStatus!);
        permissionAuthorizationService.assertMemberAccess(auth, action);
        return auth;
    }

    private originalActorId(value: unknown): Types.ObjectId | null {
        const id = this.extractObjectId(value);
        return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
    }

    private isDuplicateKeyError(error: unknown): boolean {
        return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    }

    private toWorkspaceMemberListItem(
        row: {
            memberId: Types.ObjectId;
            userId: Types.ObjectId;
            roleId: Types.ObjectId;
            status: WorkspaceMemberStatus;
            joinedAt?: Date | null;

            userEmail?: string | null;
            userLastLoginAt?: Date | null;

            profileDisplayName?: string | null;
            profileFirstName?: string | null;
            profileLastName?: string | null;

            roleName?: string | null;
            roleDisplayName?: string | null;
            roleCode?: string | null;

            invitedBy?: Types.ObjectId | null;
            inviterEmail?: string | null;
            inviterProfileDisplayName?: string | null;
            inviterProfileFirstName?: string | null;
            inviterProfileLastName?: string | null;
        },
        ownerId: string,
        requesterUserId: string,
    ): IWorkspaceMemberListItem {
        const userId = row.userId.toString();

        const userEmail = row.userEmail?.trim() ?? "";

        const roleName = row.roleDisplayName?.trim() || row.roleName?.trim() || "Member";

        const roleCode = row.roleCode?.trim() || "WORKSPACE_MEMBER";

        const addedBy = row.invitedBy
            ? {
                  id: row.invitedBy.toString(),
                  displayName: this.buildPersonDisplayName(
                      row.inviterProfileDisplayName,
                      row.inviterProfileFirstName,
                      row.inviterProfileLastName,
                      row.inviterEmail,
                  ),
                  email: row.inviterEmail?.trim() ?? "",
              }
            : null;

        return {
            id: row.memberId.toString(),

            user: {
                id: userId,
                displayName: this.buildPersonDisplayName(
                    row.profileDisplayName,
                    row.profileFirstName,
                    row.profileLastName,
                    userEmail,
                ),
                email: userEmail,
            },

            role: {
                id: row.roleId.toString(),
                code: roleCode,
                name: roleName,
            },

            status: row.status,

            joinedAt: row.joinedAt ?? null,

            /*
             * This currently uses the account's last successful login.
             * It is intentionally NOT updated on every workspace request,
             * avoiding an unnecessary write on every API call.
             */
            lastActiveAt: row.userLastLoginAt ?? null,

            addedBy,

            isOwner: userId === ownerId || roleCode === SYSTEM_ROLE_CODES.WORKSPACE_OWNER,

            isCurrentUser: userId === requesterUserId,
        };
    }

    private buildPersonDisplayName(
        displayName?: string | null,
        firstName?: string | null,
        lastName?: string | null,
        email?: string | null,
    ): string {
        const preferredName = displayName?.trim();

        if (preferredName) {
            return preferredName;
        }

        const fullName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");

        if (fullName) {
            return fullName;
        }

        const normalizedEmail = email?.trim();

        if (normalizedEmail) {
            return normalizedEmail.split("@")[0] || normalizedEmail;
        }

        return "Workspace member";
    }

    private assertAssignableWorkspaceRole(
        role: AssignableRole | null,
        workspaceId: string,
    ): asserts role is AssignableRole {
        permissionAuthorizationService.assertAssignableWorkspaceRole(role, workspaceId);
    }

    private isOwnerMember(member: { workspaceId: unknown; userId: unknown; roleId: unknown }): boolean {
        const workspace = member.workspaceId as {
            ownerId?: unknown;
        } | null;

        const role = member.roleId as {
            code?: string;
        } | null;

        if (role?.code === SYSTEM_ROLE_CODES.WORKSPACE_OWNER) {
            return true;
        }

        return Boolean(
            workspace?.ownerId &&
            this.extractObjectId(workspace.ownerId) === this.extractObjectId(member.userId),
        );
    }

    private extractObjectId(value: unknown): string {
        if (value && typeof value === "object" && "_id" in value) {
            return String(
                (
                    value as {
                        _id: unknown;
                    }
                )._id,
            );
        }

        return String(value);
    }
}
