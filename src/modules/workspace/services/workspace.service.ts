import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { workspaceListSchema, type WorkspaceListFilters } from "../validations/workspaceList.schema.js";
import type { WorkspaceDropdownFilters } from "../validations/workspaceDropdown.schema.js";
import type {
    WorkspaceListRecord,
    IWorkspacePagination,
    IWorkspaceDropdownItem,
} from "../interfaces/workspace.interface.js";
import { Types } from "mongoose";
import type {
    IWorkspaceCreate,
    IWorkspaceFilter,
    IWorkspaceResponse,
    IWorkspaceUpdate,
} from "../interfaces/workspace.interface.js";
import {
    WorkspaceAccessFilter,
    WorkspaceStatus,
    WorkspaceType,
    WorkspaceVisibility,
    isWorkspaceTrashed,
} from "../constants/workspace.enums.js";
import {
    permissionAuthorizationService,
    type IWorkspaceAuthorizationContext,
    type IGlobalAuthorizationContext,
} from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { WorkspacePurgeService } from "./workspacePurge.service.js";
import { WorkspaceMessages } from "../constants/workspace.messages.js";
import {
    WORKSPACE_CONSTANTS,
    WORKSPACE_ACCESS_FILTER_LABELS,
    WORKSPACE_STATUS_FILTER_LABELS,
    WORKSPACE_ACCESS_LABELS,
    WORKSPACE_TYPE_LABELS,
} from "../constants/workspace.constants.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { WorkspaceValidation } from "../validations/workspace.validation.js";
import { WorkspaceMemberRepository } from "../../workspaceMember/repositories/workspaceMember.repository.js";
import { WorkspaceFolderRepository } from "../../workspaceFolders/repositories/workspaceFolder.repository.js";
import { UserModel } from "../../user/models/user.model.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogConfig } from "../../../config/auditlog.config.js";

import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { UserProfileModel } from "../../userprofile/models/userProfile.model.js";
import { MediaModel } from "../../media/models/media.model.js";
import { MediaVisibility } from "../../media/constants/media.enums.js";
import { CloudflareR2Service } from "../../media/storage/cloudflareR2.service.js";
import type { IWorkspaceProfileImage } from "../interfaces/workspace.interface.js";

const WORKSPACE_MEMBER_PREVIEW_LIMIT = 4;

export class WorkspaceService {
    private readonly workspacePurgeService = new WorkspacePurgeService();
    private readonly workspaceRepository: WorkspaceRepository;
    private readonly workspaceMemberRepository: WorkspaceMemberRepository;
    private readonly workspaceFolderRepository: WorkspaceFolderRepository;
    private readonly auditLogService: AuditLogService;
    private readonly subscriptionEntitlementService: SubscriptionEntitlementService;
    private readonly storageService: CloudflareR2Service = new CloudflareR2Service();

    constructor() {
        this.workspaceRepository = new WorkspaceRepository();
        this.workspaceMemberRepository = new WorkspaceMemberRepository();
        this.workspaceFolderRepository = new WorkspaceFolderRepository();
        this.auditLogService = new AuditLogService();
        this.subscriptionEntitlementService = new SubscriptionEntitlementService();
    }

    async createWorkspace(
        data: IWorkspaceCreate,
        ownerId: string,
        context?: IAuditLogContext,
        authorization?: IGlobalAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        this.getUserObjectId(ownerId);
        if (
            !WorkspaceValidation.hasOnlyAllowedFields(data as unknown as Record<string, unknown>, [
                "name",
                "slug",
                "description",
                "visibility",
            ])
        ) {
            throw new AppError(WorkspaceMessages.UNSUPPORTED_FIELDS, 400);
        }
        if (authorization) {
            if (authorization.userId !== ownerId)
                throw new AppError(WorkspaceMessages.CANNOT_ACCESS_WORKSPACE, 403);
        }
        const auth =
            authorization ?? (await permissionAuthorizationService.resolveGlobalAuthorization(ownerId));
        permissionAuthorizationService.assertPermission(
            auth,
            PermissionModule.WORKSPACE,
            PermissionAction.CREATE,
        );
        const reservation = await this.subscriptionEntitlementService.assertCanCreateWorkspace(ownerId);
        try {
            const response = await this.persistWorkspace(data, ownerId, context);
            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return response;
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
    }

    // Internal registration flow; this operation is never exposed by a route or a client flag.
    async createPersonalWorkspace(
        data: Omit<IWorkspaceCreate, "isPersonal">,
        ownerId: string,
        context?: IAuditLogContext,
    ) {
        return this.persistWorkspace({ ...data, isPersonal: true }, ownerId, context);
    }
    private async persistWorkspace(
        data: IWorkspaceCreate,
        ownerId: string,
        context?: IAuditLogContext,
    ): Promise<IWorkspaceResponse> {
        this.validateAuditAction(AuditLogAction.CREATE);

        const ownerObjectId = this.getUserObjectId(ownerId);
        const normalizedName = WorkspaceValidation.normalizeName(data.name);
        const slug = WorkspaceValidation.normalizeSlug(data.slug ?? normalizedName);

        if (!WorkspaceValidation.isValidSlug(slug)) {
            throw new AppError(WorkspaceMessages.INVALID_SLUG, 400);
        }

        try {
            const workspace = await this.workspaceRepository.create({
                name: normalizedName,
                slug,
                description: data.description?.trim() || null,
                ownerId: ownerObjectId,
                visibility: data.visibility ?? WORKSPACE_CONSTANTS.DEFAULT_VISIBILITY,
                isPersonal: data.isPersonal ?? WORKSPACE_CONSTANTS.DEFAULT_PERSONAL_WORKSPACE,
                createdBy: ownerObjectId,
                updatedBy: ownerObjectId,
                status: WorkspaceStatus.ACTIVE,
            });

            try {
                await this.auditLogService.logCreate(
                    context ?? {},
                    {
                        module: AppModule.WORKSPACE,
                        resourceId: workspace._id.toString(),
                        resourceName: workspace.name,
                    },
                    `Workspace "${workspace.name}" was created successfully.`,
                );
            } catch (error) {
                await this.workspaceRepository.hardDeleteById(workspace._id.toString());
                throw error;
            }

            return this.toWorkspaceResponse(workspace, ownerId);
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(this.getDuplicateMessage(error), 409);
            }

            throw error;
        }
    }

    async getWorkspaceById(
        id: string,
        userId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        const auth = await this.authorizeWorkspace(
            id,
            userId,
            PermissionAction.READ,
            authorization,
            true,
            true,
        );
        const workspace = await this.workspaceRepository.findById(id);

        if (!workspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }
        if (
            !auth.isOwner &&
            [WorkspaceStatus.INACTIVE, WorkspaceStatus.SUSPENDED].includes(workspace.status)
        ) {
            throw new AppError(WorkspaceMessages.CANNOT_ACCESS_WORKSPACE, 403);
        }

        const baseResponse = this.toWorkspaceResponse(
            workspace,
            userId,
            auth.isOwner ? WORKSPACE_ACCESS_LABELS.OWNER : auth.role.name,
        );

        const ownerId = workspace.ownerId.toString();
        const profilesMap = await this.resolveUserProfilesMap([ownerId]);
        const resolvedOwner = profilesMap.get(ownerId);

        return {
            ...baseResponse,
            owner: resolvedOwner
                ? {
                      id: ownerId,
                      displayName: resolvedOwner.displayName,
                      email: resolvedOwner.email,
                      profileImage: resolvedOwner.profileImage,
                      avatarUrl: resolvedOwner.avatarUrl,
                  }
                : null,
            ownerProfileImage: resolvedOwner?.profileImage ?? null,
            ownerAvatarUrl: resolvedOwner?.avatarUrl ?? null,
        };
    }

    async getWorkspaces(userId: string, filters: WorkspaceListFilters) {
        const authenticatedUserId = this.getUserObjectId(userId).toString();
        const result = await this.workspaceRepository.listAccessible(
            authenticatedUserId,
            workspaceListSchema.parse(filters),
        );
        return {
            ...(await this.enrichWorkspaces(authenticatedUserId, result)),
            counts: result.counts,
            accessFilters: Object.values(WorkspaceAccessFilter).map((value) => ({
                value,
                label: WORKSPACE_ACCESS_FILTER_LABELS[value],
                count: result.accessCounts[value],
            })),
            statusFilters: Object.entries(WORKSPACE_STATUS_FILTER_LABELS).map(([value, label]) => ({
                value,
                label,
            })),
        };
    }

    async getMyWorkspaces(userId: string, filters: IWorkspaceFilter = {}) {
        return this.getAccessibleWorkspaces(userId, filters);
    }

    async getWorkspaceDropdown(
        userId: string,
        filters: WorkspaceDropdownFilters = {},
    ): Promise<IWorkspaceDropdownItem[]> {
        const authenticatedUserId = this.getUserObjectId(userId).toString();
        const workspaces = await this.workspaceRepository.findDropdownWorkspaces(authenticatedUserId);

        if (!workspaces.length) {
            return [];
        }

        const workspaceIds = workspaces.map((w) => w._id.toString());
        const folderSummaryMap =
            await this.workspaceFolderRepository.getActiveFolderSummariesByWorkspaceIds(workspaceIds);

        const searchRegex = filters.search
            ? new RegExp(filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
            : null;

        const result: IWorkspaceDropdownItem[] = [];

        for (const workspace of workspaces) {
            const workspaceId = workspace._id.toString();
            const folders = folderSummaryMap.get(workspaceId) ?? [];

            // "workspace and its folders give only that have atleast one folder"
            if (!folders.length) {
                continue;
            }

            if (searchRegex) {
                const workspaceMatches = searchRegex.test(workspace.name);
                const matchingFolders = folders.filter((f) => searchRegex.test(f.name));

                if (!workspaceMatches && matchingFolders.length === 0) {
                    continue;
                }

                const foldersToInclude = workspaceMatches ? folders : matchingFolders;
                if (!foldersToInclude.length) {
                    continue;
                }

                result.push({
                    id: workspaceId,
                    name: workspace.name,
                    folders: foldersToInclude.map((f) => ({
                        id: f.id,
                        name: f.name,
                    })),
                });
            } else {
                result.push({
                    id: workspaceId,
                    name: workspace.name,
                    folders: folders.map((f) => ({
                        id: f.id,
                        name: f.name,
                    })),
                });
            }
        }

        return result;
    }

    private async getAccessibleWorkspaces(userId: string, filters: IWorkspaceFilter = {}) {
        this.getUserObjectId(userId);

        const normalizedFilters = this.normalizeFilters({ ...filters, ownerId: undefined });
        const memberships = await this.workspaceRepository.findReadableMemberships(userId);
        const memberWorkspaceIds: string[] = [
            ...new Set<string>(memberships.map((membership) => membership.workspaceId.toString())),
        ];

        const result = await this.workspaceRepository.findAccessibleByUser(
            userId,
            memberWorkspaceIds,
            normalizedFilters,
        );

        const membershipMap = new Map(
            memberships.map((membership) => [membership.workspaceId.toString(), membership]),
        );
        return this.enrichWorkspaces(userId, {
            ...result,
            data: result.data.map((workspace) => ({
                ...workspace,
                membership: membershipMap.get(workspace._id.toString()) ?? null,
            })),
        });
    }

    private async enrichWorkspaces(
        userId: string,
        result: { data: WorkspaceListRecord[]; pagination: IWorkspacePagination },
    ) {
        if (!result.data.length) {
            return { data: [], pagination: result.pagination };
        }

        const workspaceIds = result.data.map((workspace) => workspace._id.toString());
        const ownerIds = [...new Set<string>(result.data.map((workspace) => workspace.ownerId.toString()))];
        const [folderSummaryMap, memberSummaryMap, ownerUsers] = await Promise.all([
            this.workspaceFolderRepository.getActiveFolderSummariesByWorkspaceIds(workspaceIds),
            this.workspaceMemberRepository.getActiveMemberSummariesByWorkspaceIds(
                workspaceIds,
                WORKSPACE_MEMBER_PREVIEW_LIMIT,
            ),
            this.getWorkspaceOwners(ownerIds),
        ]);

        const allMemberUserIds: string[] = [];
        for (const summary of memberSummaryMap.values()) {
            for (const member of summary.members) {
                if (member.id) {
                    allMemberUserIds.push(member.id);
                }
            }
        }
        const allUserIdsToResolve = [...new Set<string>([...ownerIds, ...allMemberUserIds])];
        const userProfilesMap = await this.resolveUserProfilesMap(allUserIdsToResolve);

        const ownerMap = new Map(ownerUsers.map((owner: any) => [String(owner._id), owner]));

        return {
            data: result.data.map((workspace) => {
                const workspaceId = workspace._id.toString();
                const ownerId = workspace.ownerId.toString();
                const folders = folderSummaryMap.get(workspaceId) ?? [];
                const isOwner = ownerId === userId;
                const membership = workspace.membership ?? null;
                const memberSummary = memberSummaryMap.get(workspaceId) ?? { count: 0, members: [] };
                const owner = ownerMap.get(ownerId);
                const resolvedOwner = userProfilesMap.get(ownerId);

                const ownerDisplayName =
                    resolvedOwner?.displayName || this.getUserDisplayName(owner);
                const ownerEmail =
                    resolvedOwner?.email || String(owner?.email ?? "").trim();
                const ownerProfileImage = resolvedOwner?.profileImage ?? null;
                const ownerAvatarUrl = resolvedOwner?.avatarUrl ?? null;

                const ownerPreview = {
                    id: ownerId,
                    displayName: ownerDisplayName,
                    email: ownerEmail,
                    role: "Owner",
                    isOwner: true,
                    profileImage: ownerProfileImage,
                    avatarUrl: ownerAvatarUrl,
                };

                const isPersonal = isOwner && Boolean(workspace.isPersonal);
                const memberRole = membership?.roleName;
                const members = [
                    ownerPreview,
                    ...memberSummary.members.map((member) => {
                        const resolvedMember = userProfilesMap.get(member.id);
                        return {
                            ...member,
                            displayName: resolvedMember?.displayName || member.displayName,
                            profileImage: resolvedMember?.profileImage ?? null,
                            avatarUrl: resolvedMember?.avatarUrl ?? null,
                        };
                    }),
                ].slice(0, WORKSPACE_MEMBER_PREVIEW_LIMIT);

                return {
                    ...this.toWorkspaceResponse(
                        workspace,
                        userId,
                        isOwner ? WORKSPACE_ACCESS_LABELS.OWNER : memberRole,
                    ),
                    owner: {
                        id: ownerId,
                        displayName: ownerDisplayName,
                        email: ownerEmail,
                        profileImage: ownerProfileImage,
                        avatarUrl: ownerAvatarUrl,
                    },
                    ownerProfileImage,
                    ownerAvatarUrl,
                    summary: {
                        folderCount: folders.length,
                        folders,
                        memberCount: memberSummary.count + 1,
                        members,
                    },
                };
            }),
            pagination: result.pagination,
        };
    }

    async updateWorkspace(
        id: string,
        data: IWorkspaceUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        this.validateAuditAction(AuditLogAction.UPDATE);

        const auth = await this.authorizeWorkspace(id, updatedBy, PermissionAction.UPDATE, authorization);
        if (
            !WorkspaceValidation.hasOnlyAllowedFields(data as unknown as Record<string, unknown>, [
                "name",
                "slug",
                "description",
                "visibility",
            ])
        ) {
            throw new AppError(WorkspaceMessages.UNSUPPORTED_FIELDS, 400);
        }
        if (data.visibility !== undefined)
            permissionAuthorizationService.assertWorkspaceAccess(auth, PermissionAction.SETTINGS);
        const updatedByObjectId = this.getUserObjectId(updatedBy);
        const workspace = await this.workspaceRepository.findById(id);

        if (!workspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }

        const updateData: IWorkspaceUpdate = {};
        const changes: Array<{ field: string; oldValue?: unknown; newValue?: unknown }> = [];

        if (data.name !== undefined) {
            const name = WorkspaceValidation.normalizeName(data.name);

            if (name !== workspace.name) {
                updateData.name = name;

                changes.push({ field: "name", oldValue: workspace.name, newValue: name });
            }
        }

        if (data.slug !== undefined) {
            const slug = WorkspaceValidation.normalizeSlug(data.slug);

            if (!WorkspaceValidation.isValidSlug(slug)) {
                throw new AppError(WorkspaceMessages.INVALID_SLUG, 400);
            }

            if (slug !== workspace.slug) {
                updateData.slug = slug;

                changes.push({ field: "slug", oldValue: workspace.slug, newValue: slug });
            }
        }

        if (data.description !== undefined) {
            const description = data.description?.trim() || null;

            if (description !== (workspace.description ?? null)) {
                updateData.description = description;

                changes.push({
                    field: "description",
                    oldValue: workspace.description ?? null,
                    newValue: description,
                });
            }
        }

        if (data.visibility !== undefined && data.visibility !== workspace.visibility) {
            updateData.visibility = data.visibility;

            changes.push({ field: "visibility", oldValue: workspace.visibility, newValue: data.visibility });
        }

        if (!changes.length) {
            return this.toWorkspaceResponse(workspace, updatedBy);
        }

        const previousState = this.workspaceSnapshot(workspace);

        try {
            const updatedWorkspace = await this.workspaceRepository.updateById(id, {
                ...updateData,
                updatedBy: updatedByObjectId,
            });

            if (!updatedWorkspace) {
                throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
            }

            try {
                await this.auditLogService.logUpdate(
                    context ?? {},
                    {
                        module: AppModule.WORKSPACE,
                        resourceId: updatedWorkspace._id.toString(),
                        resourceName: updatedWorkspace.name,
                    },
                    `Workspace "${updatedWorkspace.name}" was updated successfully.`,
                    changes,
                );
            } catch (error) {
                await this.workspaceRepository.rollbackById(id, previousState);

                throw error;
            }

            return this.toWorkspaceResponse(updatedWorkspace, updatedBy);
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(WorkspaceMessages.SLUG_ALREADY_EXISTS, 409);
            }

            throw error;
        }
    }

    async updateWorkspaceStatus(
        id: string,
        status: WorkspaceStatus,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        this.validateAuditAction(AuditLogAction.STATUS_CHANGE);
        if (!WorkspaceValidation.isValidStatus(status))
            throw new AppError(WorkspaceMessages.INVALID_STATUS, 400);

        if (isWorkspaceTrashed(status)) {
            throw new AppError(WorkspaceMessages.CANNOT_DELETE_THROUGH_STATUS, 400);
        }

        const auth = await this.authorizeWorkspace(
            id,
            updatedBy,
            PermissionAction.UPDATE,
            authorization,
            false,
            true,
        );
        const updatedByObjectId = this.getUserObjectId(updatedBy);
        const workspace = await this.workspaceRepository.findById(id);

        if (!workspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }
        if (
            [WorkspaceStatus.INACTIVE, WorkspaceStatus.SUSPENDED].includes(status) ||
            [WorkspaceStatus.INACTIVE, WorkspaceStatus.SUSPENDED].includes(workspace.status)
        ) {
            permissionAuthorizationService.assertWorkspaceAccess(auth, PermissionAction.SETTINGS);
        }

        if (workspace.status === status) {
            return this.toWorkspaceResponse(workspace, updatedBy);
        }

        const previousState = this.workspaceSnapshot(workspace);
        const oldStatus = workspace.status;
        const updatedWorkspace = await this.workspaceRepository.updateStatus(id, status, updatedByObjectId);

        if (!updatedWorkspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logStatusChange(
                context ?? {},
                {
                    module: AppModule.WORKSPACE,
                    resourceId: updatedWorkspace._id.toString(),
                    resourceName: updatedWorkspace.name,
                },
                "status",
                oldStatus,
                status,
                `Workspace "${updatedWorkspace.name}" status changed from ${oldStatus} to ${status}.`,
            );
        } catch (error) {
            await this.workspaceRepository.rollbackById(id, previousState);

            throw error;
        }

        return this.toWorkspaceResponse(updatedWorkspace, updatedBy);
    }

    async deleteWorkspace(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        this.validateAuditAction(AuditLogAction.DELETE);
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);

        const updatedByObjectId = this.getUserObjectId(updatedBy);
        const workspace = await this.workspaceRepository.findByIdIncludingDeleted(id);

        if (!workspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }

        await this.authorizeWorkspace(id, updatedBy, PermissionAction.DELETE, authorization, true);

        if (isWorkspaceTrashed(workspace.status)) {
            throw new AppError(WorkspaceMessages.ALREADY_TRASHED, 400);
        }

        if (workspace.isPersonal) {
            throw new AppError(WorkspaceMessages.CANNOT_DELETE_PERSONAL_WORKSPACE, 400);
        }

        const previousState = this.workspaceSnapshot(workspace);
        const deletedWorkspace = await this.workspaceRepository.softDelete(id, updatedByObjectId);

        if (!deletedWorkspace) {
            throw new AppError(WorkspaceMessages.CANNOT_DELETE_WORKSPACE, 409);
        }

        try {
            await this.auditLogService.logDelete(
                context ?? {},
                {
                    module: AppModule.WORKSPACE,
                    resourceId: deletedWorkspace._id.toString(),
                    resourceName: deletedWorkspace.name,
                },
                `Workspace "${deletedWorkspace.name}" was moved to trash and will be retained for ${WORKSPACE_CONSTANTS.TRASH.RETENTION_DAYS} days.`,
            );
        } catch (error) {
            await this.workspaceRepository.rollbackById(id, previousState);

            throw error;
        }

        return this.toWorkspaceResponse(deletedWorkspace, updatedBy);
    }

    async restoreWorkspace(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceResponse> {
        this.validateAuditAction(AuditLogAction.RESTORE);
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);

        const updatedByObjectId = this.getUserObjectId(updatedBy);
        const workspace = await this.workspaceRepository.findByIdIncludingDeleted(id);

        if (!workspace) {
            throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        }

        await this.authorizeWorkspace(id, updatedBy, PermissionAction.UPDATE, authorization, true);

        if (!isWorkspaceTrashed(workspace.status)) {
            throw new AppError(WorkspaceMessages.RESTORE_ONLY_TRASHED, 400);
        }
        if (workspace.purgeAfter && workspace.purgeAfter <= new Date()) {
            throw new AppError(WorkspaceMessages.RESTORE_WINDOW_EXPIRED, 410);
        }

        const reservation = await this.subscriptionEntitlementService.assertCanRestoreWorkspace(
            updatedBy,
            id,
        );
        let notesReservation: Awaited<
            ReturnType<SubscriptionEntitlementService["reserveWorkspaceRestoredNotes"]>
        > = null;
        try {
            notesReservation = await this.subscriptionEntitlementService.reserveWorkspaceRestoredNotes(id);
            const previousState = this.workspaceSnapshot(workspace);
            const restoredWorkspace = await this.workspaceRepository.restore(id, updatedByObjectId);

            if (!restoredWorkspace) {
                throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
            }

            try {
                await this.auditLogService.log({
                    ...(context ?? {}),
                    action: AuditLogAction.RESTORE,
                    module: AppModule.WORKSPACE,
                    resourceId: restoredWorkspace._id.toString(),
                    resourceName: restoredWorkspace.name,
                    description: `Workspace "${restoredWorkspace.name}" was restored successfully.`,
                });
            } catch (error) {
                await this.workspaceRepository.rollbackById(id, previousState);

                throw error;
            }

            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            if (notesReservation) {
                await this.subscriptionEntitlementService.commitReservation(notesReservation.reservationId);
            }
            return this.toWorkspaceResponse(restoredWorkspace, updatedBy);
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            if (notesReservation) {
                await this.subscriptionEntitlementService.releaseReservation(notesReservation.reservationId);
            }
            throw error;
        }
    }

    async permanentlyDeleteWorkspace(
        id: string,
        deletedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        this.getUserObjectId(deletedBy);
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        const workspace = await this.workspaceRepository.findByIdIncludingDeleted(id);
        if (!workspace) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        await this.authorizeWorkspace(id, deletedBy, PermissionAction.DELETE, authorization, true);
        if (!isWorkspaceTrashed(workspace.status))
            throw new AppError(WorkspaceMessages.PERMANENT_DELETE_REQUIRES_TRASH, 400);
        if (workspace.isPersonal) throw new AppError(WorkspaceMessages.CANNOT_DELETE_PERSONAL_WORKSPACE, 400);
        const result = await this.workspacePurgeService.purgeById(id);
        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.WORKSPACE,
                resourceId: id,
                resourceName: workspace.name,
            },
            `Workspace "${workspace.name}" was permanently deleted with its dependent workspace data.`,
        );
        return result;
    }

    async purgeExpiredWorkspaces(now = new Date(), batchSize = WORKSPACE_CONSTANTS.TRASH.PURGE_BATCH_SIZE) {
        const ids = await this.workspaceRepository.findExpiredTrashedIds(now, batchSize);
        const result = { found: ids.length, purged: 0, failed: 0, failedIds: [] as string[] };
        for (const id of ids) {
            try {
                await this.workspacePurgeService.purgeById(id);
                result.purged += 1;
            } catch {
                result.failed += 1;
                result.failedIds.push(id);
            }
        }
        await this.workspacePurgeService.cleanupDeletedMedia();
        return result;
    }

    private async authorizeWorkspace(
        id: string,
        userId: string,
        action: PermissionAction | PermissionAction[],
        authorization?: IWorkspaceAuthorizationContext,
        allowTrashed = false,
        allowInactive = false,
    ): Promise<IWorkspaceAuthorizationContext> {
        this.getUserObjectId(userId);
        if (!Types.ObjectId.isValid(id)) throw new AppError(WorkspaceMessages.NOT_FOUND, 404);
        if (authorization) {
            if (authorization.userId !== userId || authorization.workspaceId !== id) {
                throw new AppError(WorkspaceMessages.CANNOT_ACCESS_WORKSPACE, 403);
            }
        }
        // Legacy contexts without state must be resolved again; permissive READ/restore contexts
        // cannot be reused to mutate a trashed or inactive workspace.
        const auth =
            authorization?.workspaceStatus !== undefined
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(
                      userId,
                      id,
                      allowTrashed,
                      allowInactive,
                  );
        permissionAuthorizationService.assertWorkspaceState(
            auth.workspaceStatus!,
            allowTrashed,
            allowInactive,
        );
        permissionAuthorizationService.assertWorkspaceAccess(auth, action);
        if (
            (Array.isArray(action) ? action : [action]).some(
                (value) => value === PermissionAction.UPDATE || value === PermissionAction.CREATE,
            )
        )
            await this.subscriptionEntitlementService.assertWorkspaceFeature(id, FeatureCode.WORKSPACES);
        return auth;
    }

    private async getWorkspaceOwners(ownerIds: string[]): Promise<any[]> {
        if (!ownerIds.length) {
            return [];
        }

        const objectIds = ownerIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (!objectIds.length) {
            return [];
        }

        return UserModel.find({ _id: { $in: objectIds } })
            .select("_id email displayName firstName lastName")
            .lean()
            .exec();
    }

    private getUserDisplayName(user: any, profile?: any): string {
        const profileDisplayName = String(profile?.displayName ?? "").trim();
        if (profileDisplayName) {
            return profileDisplayName;
        }

        const userDisplayName = String(user?.displayName ?? "").trim();
        if (userDisplayName) {
            return userDisplayName;
        }

        const fullName = [
            String(profile?.firstName || user?.firstName || "").trim(),
            String(profile?.lastName || user?.lastName || "").trim(),
        ]
            .filter(Boolean)
            .join(" ");

        if (fullName) {
            return fullName;
        }

        const email = String(user?.email ?? "").trim();
        if (email) {
            return email.split("@")[0] || "Workspace owner";
        }

        return "Workspace owner";
    }

    private async resolveUserProfilesMap(
        userIds: string[],
    ): Promise<
        Map<
            string,
            {
                id: string;
                displayName: string;
                email: string;
                avatarUrl: string | null;
                profileImage: IWorkspaceProfileImage | null;
            }
        >
    > {
        const result = new Map<
            string,
            {
                id: string;
                displayName: string;
                email: string;
                avatarUrl: string | null;
                profileImage: IWorkspaceProfileImage | null;
            }
        >();

        const validIds = userIds
            .filter((id) => id && Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (validIds.length === 0) return result;

        const [users, profiles] = await Promise.all([
            UserModel.find({ _id: { $in: validIds } })
                .select("_id email displayName firstName lastName")
                .lean()
                .exec(),
            UserProfileModel.find({ userId: { $in: validIds } })
                .select("userId displayName firstName lastName profileImage avatarUrl")
                .lean()
                .exec(),
        ]);

        const userMap = new Map<string, any>();
        for (const u of users) {
            userMap.set(u._id.toString(), u);
        }

        const profileMap = new Map<string, (typeof profiles)[0]>();
        const mediaIds: Types.ObjectId[] = [];

        for (const p of profiles) {
            const uidStr = p.userId.toString();
            profileMap.set(uidStr, p);
            if (p.profileImage && Types.ObjectId.isValid(String(p.profileImage))) {
                mediaIds.push(new Types.ObjectId(String(p.profileImage)));
            }
        }

        const mediaMap = new Map<string, { id: string; url: string }>();
        if (mediaIds.length > 0) {
            const mediaDocs = await MediaModel.find({
                _id: { $in: mediaIds },
                isDeleted: { $ne: true },
            })
                .select("_id storageKey publicUrl visibility")
                .lean()
                .exec();

            for (const media of mediaDocs) {
                try {
                    let url: string;
                    if (media.visibility === MediaVisibility.PUBLIC && media.publicUrl) {
                        url = media.publicUrl;
                    } else if (media.visibility === MediaVisibility.PUBLIC) {
                        url = this.storageService.getPublicUrl(media.storageKey);
                    } else {
                        url = await this.storageService.createDownloadUrl(media.storageKey);
                    }
                    mediaMap.set(media._id.toString(), {
                        id: media._id.toString(),
                        url,
                    });
                } catch {
                    // Gracefully skip presigned URL generation failure
                }
            }
        }

        for (const idObj of validIds) {
            const idStr = idObj.toString();
            const user = userMap.get(idStr);
            const profile = profileMap.get(idStr);

            const email = String(user?.email ?? "").trim();
            const displayName = this.getUserDisplayName(user, profile);

            const profileImage: IWorkspaceProfileImage | null =
                profile?.profileImage && mediaMap.has(profile.profileImage.toString())
                    ? (mediaMap.get(profile.profileImage.toString()) ?? null)
                    : null;
            const avatarUrl = profileImage?.url ?? (profile as any)?.avatarUrl ?? null;

            result.set(idStr, {
                id: idStr,
                displayName,
                email,
                avatarUrl,
                profileImage,
            });
        }

        return result;
    }

    private normalizeFilters(filters: IWorkspaceFilter): IWorkspaceFilter {
        return {
            ...filters,
            search: filters.search?.trim() || undefined,
            page: Math.max(1, filters.page ?? WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_PAGE),
            limit: Math.min(
                Math.max(1, filters.limit ?? WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_LIMIT),
                WORKSPACE_CONSTANTS.PAGINATION.MAX_LIMIT,
            ),
            sortBy: filters.sortBy ?? WORKSPACE_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder: filters.sortOrder ?? WORKSPACE_CONSTANTS.DEFAULT_SORT_ORDER,
        };
    }

    private validateAuditAction(action: AuditLogAction): void {
        const moduleConfig = AuditLogConfig[AppModule.WORKSPACE];

        if (!moduleConfig || !moduleConfig.actions.includes(action)) {
            throw new AppError(`Action ${action} is not allowed for module ${AppModule.WORKSPACE}.`, 400);
        }
    }

    private workspaceSnapshot(workspace: {
        name: string;
        slug: string;
        description?: string | null;
        status: WorkspaceStatus;
        visibility: WorkspaceVisibility;
        isPersonal: boolean;
        updatedBy?: Types.ObjectId | null;
        updatedAt?: Date;
        deletedAt?: Date | null;
        deletedBy?: Types.ObjectId | null;
        purgeAfter?: Date | null;
    }): Record<string, unknown> {
        return {
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description ?? null,
            status: workspace.status,
            visibility: workspace.visibility,
            isPersonal: workspace.isPersonal,
            updatedBy: workspace.updatedBy ?? null,
            updatedAt: workspace.updatedAt,
            deletedAt: workspace.deletedAt ?? null,
            deletedBy: workspace.deletedBy ?? null,
            purgeAfter: workspace.purgeAfter ?? null,
        };
    }

    private toWorkspaceResponse(
        workspace: {
            _id: Types.ObjectId | string;
            name: string;
            slug: string;
            description?: string | null;
            ownerId: Types.ObjectId | string;
            status: WorkspaceStatus;
            visibility: WorkspaceVisibility;
            isPersonal: boolean;
            createdBy?: Types.ObjectId | string | null;
            updatedBy?: Types.ObjectId | string | null;
            createdAt?: Date;
            updatedAt?: Date;
            deletedAt?: Date | null;
            deletedBy?: Types.ObjectId | null;
            purgeAfter?: Date | null;
        },
        currentUserId?: string,
        userRole?: string,
    ): IWorkspaceResponse {
        const ownerId = this.resolveId(workspace.ownerId);
        const isOwner = currentUserId ? ownerId === currentUserId : true;
        const isPersonal = isOwner && Boolean(workspace.isPersonal);
        const isInvited = currentUserId ? !isOwner : false;
        const role = isOwner ? WORKSPACE_ACCESS_LABELS.OWNER : userRole || WORKSPACE_ACCESS_LABELS.MEMBER;
        const workspaceType = isPersonal ? WorkspaceType.PERSONAL : WorkspaceType.TEAM;
        const workspaceTypeLabel = WORKSPACE_TYPE_LABELS[workspaceType];
        const label = isPersonal ? "PERSONAL" : isInvited ? "INVITED" : "WORKSPACE";

        return {
            id: this.resolveId(workspace._id),
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description ?? null,
            ownerId,
            status: workspace.status,
            visibility: workspace.visibility,
            isPersonal,
            isOwner,
            isInvited,
            role,
            workspaceType,
            workspaceTypeLabel,
            label,
            createdBy: workspace.createdBy ? this.resolveId(workspace.createdBy) : null,
            updatedBy: workspace.updatedBy ? this.resolveId(workspace.updatedBy) : null,
            deletedAt: workspace.deletedAt ?? null,
            deletedBy: workspace.deletedBy ? this.resolveId(workspace.deletedBy) : null,
            purgeAfter: workspace.purgeAfter ?? null,
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
        };
    }

    private getUserObjectId(userId: string): Types.ObjectId {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(WorkspaceMessages.INVALID_USER_ID, 401);
        }

        return new Types.ObjectId(userId);
    }

    private resolveId(value: unknown): string {
        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "object" && value !== null && "_id" in value) {
            return String((value as { _id?: unknown })._id ?? "");
        }

        return "";
    }

    private getDuplicateMessage(error: unknown): string {
        if (typeof error === "object" && error !== null) {
            if ("keyPattern" in error) {
                const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;

                if (keyPattern && "slug" in keyPattern) {
                    return WorkspaceMessages.SLUG_ALREADY_EXISTS;
                }
            }

            if (
                "message" in error &&
                String((error as { message?: unknown }).message).includes("uniq_workspace_slug")
            ) {
                return WorkspaceMessages.SLUG_ALREADY_EXISTS;
            }
        }

        return WorkspaceMessages.ALREADY_EXISTS;
    }

    private isDuplicateKeyError(error: unknown): boolean {
        return (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: unknown }).code === 11000
        );
    }
}
