import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { Types } from "mongoose";
import type {
    IWorkspaceFolderCreate,
    IWorkspaceFolderFilter,
    IWorkspaceFolderResponse,
    IWorkspaceFolderSummary,
    IWorkspaceFolderUpdate,
} from "../interfaces/workspaceFolder.interface.js";
import { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";
import { WorkspaceFolderMessages } from "../constants/workspaceFolder.messages.js";
import { WorkspaceFolderRepository } from "../repositories/workspaceFolder.repository.js";
import { WorkspaceFolderValidation } from "../validations/workspaceFolder.validation.js";
import {
    permissionAuthorizationService,
    type IWorkspaceAuthorizationContext,
} from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction } from "../../permissions/constants/permission.enums.js";
import {
    createFolderSchema,
    updateFolderSchema,
    folderListSchema,
    folderStatusSchema,
} from "../validations/workspaceFolder.schema.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogConfig } from "../../../config/auditlog.config.js";
import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { StickyNoteColumnService } from "../../stickynotescolumns/services/stickyNoteColumn.service.js";

export class WorkspaceFolderService {
    private readonly workspaceFolderRepository: WorkspaceFolderRepository;
    private readonly auditLogService: AuditLogService;
    private readonly subscriptionEntitlementService: SubscriptionEntitlementService;
    private readonly stickyNoteColumnService: StickyNoteColumnService;

    constructor() {
        this.workspaceFolderRepository = new WorkspaceFolderRepository();
        this.auditLogService = new AuditLogService();
        this.subscriptionEntitlementService = new SubscriptionEntitlementService();
        this.stickyNoteColumnService = new StickyNoteColumnService();
    }

    async createWorkspaceFolder(
        data: IWorkspaceFolderCreate,
        createdBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        const validated = createFolderSchema.parse({ ...data, workspaceId: String(data.workspaceId) });
        const auth = await this.assertWorkspaceAccess(
            String(validated.workspaceId),
            createdBy,
            PermissionAction.CREATE,
            authorization,
        );
        const reservation = await this.subscriptionEntitlementService.assertCanCreateFolder(
            createdBy,
            String(validated.workspaceId),
        );
        try {
            const result = await this.persistFolder(validated, createdBy, auth, context);
            try {
                await this.stickyNoteColumnService.createDefaultColumns(
                    String(validated.workspaceId),
                    result.id,
                    createdBy,
                );
            } catch (columnError) {
                await this.workspaceFolderRepository.hardDeleteById(result.id);
                throw columnError;
            }
            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return result;
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
    }

    async createDefaultWorkspaceFolder(
        data: IWorkspaceFolderCreate,
        createdBy: string,
        context?: IAuditLogContext,
    ) {
        const auth = await this.assertWorkspaceAccess(
            String(data.workspaceId),
            createdBy,
            PermissionAction.CREATE,
        );
        return this.persistFolder({ ...data, isDefault: true }, createdBy, auth, context);
    }

    private async persistFolder(
        data: IWorkspaceFolderCreate,
        createdBy: string,
        auth: IWorkspaceAuthorizationContext,
        context?: IAuditLogContext,
    ): Promise<IWorkspaceFolderResponse> {
        this.validateAuditAction(AuditLogAction.CREATE);

        const userObjectId = this.getUserObjectId(createdBy);
        const workspaceId = this.getObjectIdString(
            data.workspaceId,
            WorkspaceFolderMessages.INVALID_WORKSPACE_ID,
        );

        const normalizedName = WorkspaceFolderValidation.normalizeName(data.name);
        const slug = WorkspaceFolderValidation.normalizeSlug(data.slug ?? normalizedName);

        if (!WorkspaceFolderValidation.isValidSlug(slug)) {
            throw new AppError(WorkspaceFolderMessages.INVALID_SLUG, 400);
        }

        if (data.isDefault === true) {
            const defaultFolder = await this.workspaceFolderRepository.findDefaultFolder(workspaceId);
            if (defaultFolder) {
                throw new AppError(WorkspaceFolderMessages.DEFAULT_FOLDER_EXISTS, 409);
            }
        }

        const position =
            data.position !== undefined
                ? data.position
                : (await this.workspaceFolderRepository.getHighestPosition(workspaceId)) + 1;

        try {
            const folder = await this.workspaceFolderRepository.create({
                workspaceId: new Types.ObjectId(workspaceId),
                name: normalizedName,
                slug,
                description: data.description?.trim() || null,
                icon: data.icon?.trim() || null,
                color: data.color?.trim() || null,
                position,
                isDefault: data.isDefault ?? false,
                status: WorkspaceFolderStatus.ACTIVE,
                createdBy: userObjectId,
                updatedBy: userObjectId,
            });

            try {
                await this.auditLogService.logCreate(
                    context ?? {},
                    {
                        module: AppModule.WORKSPACE_FOLDER,
                        resourceId: folder._id.toString(),
                        resourceName: folder.name,
                    },
                    `Workspace folder "${folder.name}" was created successfully.`,
                );
            } catch (error) {
                await this.workspaceFolderRepository.hardDeleteById(folder._id.toString());
                throw error;
            }

            return this.toWorkspaceFolderResponse(folder, auth);
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(this.getDuplicateMessage(error), 409);
            }

            throw error;
        }
    }

    async getWorkspaceFolderById(
        id: string,
        userId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        const folder = await this.workspaceFolderRepository.findByIdIncludingDeleted(id);

        if (!folder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        const auth = await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            userId,
            PermissionAction.READ,
            authorization,
        );

        const summaryMap = await this.workspaceFolderRepository.getStickyNoteCountsByFolderIds([id]);
        const summary = summaryMap.get(id) ?? {
            stickyNoteCount: 0,
            stickyNotesCount: 0,
            total: 0,
            active: 0,
            archived: 0,
        };

        return this.toWorkspaceFolderResponse(folder, auth, summary);
    }

    async getWorkspaceFolders(
        userId: string,
        filters: IWorkspaceFolderFilter = {},
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        return this.getAccessibleWorkspaceFolders(userId, filters, authorization);
    }

    async getMyWorkspaceFolders(
        userId: string,
        filters: IWorkspaceFolderFilter = {},
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        return this.getAccessibleWorkspaceFolders(userId, filters, authorization);
    }

    private async getAccessibleWorkspaceFolders(
        userId: string,
        filters: IWorkspaceFolderFilter = {},
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        this.getUserObjectId(userId);

        const normalizedFilters = folderListSchema.parse({
            ...filters,
            ...(filters.workspaceId ? { workspaceId: String(filters.workspaceId) } : {}),
            ...(filters.createdBy ? { createdBy: String(filters.createdBy) } : {}),
        });
        let accessibleWorkspaceIds: string[];
        const authorizations = new Map<string, IWorkspaceAuthorizationContext>();
        if (normalizedFilters.workspaceId) {
            const auth = await this.assertWorkspaceAccess(
                normalizedFilters.workspaceId,
                userId,
                PermissionAction.READ,
                authorization,
            );
            authorizations.set(normalizedFilters.workspaceId, auth);
            accessibleWorkspaceIds = [normalizedFilters.workspaceId];
        } else {
            accessibleWorkspaceIds = await this.workspaceFolderRepository.findReadableWorkspaceIds(userId);
        }

        const result = await this.workspaceFolderRepository.findAccessibleByUser(
            accessibleWorkspaceIds,
            normalizedFilters,
        );

        // Resolve once per workspace on this page, never once per folder.
        await Promise.all(
            [...new Set(result.data.map((folder) => folder.workspaceId.toString()))].map(
                async (workspaceId) => {
                    if (!authorizations.has(workspaceId)) {
                        authorizations.set(
                            workspaceId,
                            await this.assertWorkspaceAccess(workspaceId, userId, PermissionAction.READ),
                        );
                    }
                },
            ),
        );
        const folderIds = result.data.map((folder) => folder._id.toString());
        const summaryMap = await this.workspaceFolderRepository.getStickyNoteCountsByFolderIds(folderIds);

        return {
            data: result.data.map((folder) => {
                const folderId = folder._id.toString();
                const auth = authorizations.get(folder.workspaceId.toString())!;
                const summary = summaryMap.get(folderId) ?? {
                    stickyNoteCount: 0,
                    stickyNotesCount: 0,
                    total: 0,
                    active: 0,
                    archived: 0,
                };
                return this.toWorkspaceFolderResponse(folder, auth, summary);
            }),
            pagination: result.pagination,
            ...(normalizedFilters.workspaceId
                ? {
                      allowedActions: {
                          canCreate: permissionAuthorizationService.canAccessFolder(
                              authorizations.get(normalizedFilters.workspaceId)!,
                              PermissionAction.CREATE,
                          ),
                      },
                  }
                : {}),
            counts: result.counts,
            statusFilters: [
                { value: "ALL", label: "All statuses" },
                ...Object.values(WorkspaceFolderStatus).map((value) => ({
                    value,
                    label:
                        value === WorkspaceFolderStatus.DELETED
                            ? "Trash"
                            : value.charAt(0) + value.slice(1).toLowerCase(),
                })),
            ],
        };
    }

    async updateWorkspaceFolder(
        id: string,
        data: IWorkspaceFolderUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        data = updateFolderSchema.parse(data);
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        this.validateAuditAction(AuditLogAction.UPDATE);

        const userObjectId = this.getUserObjectId(updatedBy);

        const folder = await this.workspaceFolderRepository.findById(id);

        if (!folder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        const auth = await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            updatedBy,
            PermissionAction.UPDATE,
            authorization,
        );

        const updateData: IWorkspaceFolderUpdate = {};
        const changes: Array<{
            field: string;
            oldValue?: unknown;
            newValue?: unknown;
        }> = [];

        if (data.name !== undefined) {
            const name = WorkspaceFolderValidation.normalizeName(data.name);

            if (name !== folder.name) {
                updateData.name = name;
                changes.push({
                    field: "name",
                    oldValue: folder.name,
                    newValue: name,
                });
            }
        }

        if (data.slug !== undefined) {
            const slug = WorkspaceFolderValidation.normalizeSlug(data.slug);

            if (!WorkspaceFolderValidation.isValidSlug(slug)) {
                throw new AppError(WorkspaceFolderMessages.INVALID_SLUG, 400);
            }

            if (slug !== folder.slug) {
                updateData.slug = slug;
                changes.push({
                    field: "slug",
                    oldValue: folder.slug,
                    newValue: slug,
                });
            }
        }

        if (data.description !== undefined) {
            const description = data.description?.trim() || null;

            if (description !== (folder.description ?? null)) {
                updateData.description = description;
                changes.push({
                    field: "description",
                    oldValue: folder.description ?? null,
                    newValue: description,
                });
            }
        }

        if (data.icon !== undefined) {
            const icon = data.icon?.trim() || null;

            if (icon !== (folder.icon ?? null)) {
                updateData.icon = icon;
                changes.push({
                    field: "icon",
                    oldValue: folder.icon ?? null,
                    newValue: icon,
                });
            }
        }

        if (data.color !== undefined) {
            const color = data.color?.trim() || null;

            if (color !== (folder.color ?? null)) {
                updateData.color = color;
                changes.push({
                    field: "color",
                    oldValue: folder.color ?? null,
                    newValue: color,
                });
            }
        }

        if (data.position !== undefined && data.position !== folder.position) {
            updateData.position = data.position;
            changes.push({
                field: "position",
                oldValue: folder.position,
                newValue: data.position,
            });
        }

        if (!changes.length) {
            return this.toWorkspaceFolderResponse(folder, auth);
        }

        const previousState = this.folderSnapshot(folder);

        try {
            const updatedFolder = await this.workspaceFolderRepository.updateById(id, {
                ...updateData,
                updatedBy: userObjectId,
            });

            if (!updatedFolder) {
                throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
            }

            try {
                await this.auditLogService.logUpdate(
                    context ?? {},
                    {
                        module: AppModule.WORKSPACE_FOLDER,
                        resourceId: updatedFolder._id.toString(),
                        resourceName: updatedFolder.name,
                    },
                    `Workspace folder "${updatedFolder.name}" was updated successfully.`,
                    changes,
                );
            } catch (error) {
                await this.workspaceFolderRepository.rollbackById(id, previousState);
                throw error;
            }

            return this.toWorkspaceFolderResponse(updatedFolder, auth);
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(this.getDuplicateMessage(error), 409);
            }

            throw error;
        }
    }

    async updateWorkspaceFolderStatus(
        id: string,
        status: WorkspaceFolderStatus,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        this.validateAuditAction(AuditLogAction.STATUS_CHANGE);

        if (status === WorkspaceFolderStatus.DELETED) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_DELETE_THROUGH_STATUS, 400);
        }
        folderStatusSchema.parse({ status });

        const userObjectId = this.getUserObjectId(updatedBy);

        const folder = await this.workspaceFolderRepository.findById(id);

        if (!folder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        const auth = await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            updatedBy,
            PermissionAction.UPDATE,
            authorization,
        );

        if (folder.isDefault && status === WorkspaceFolderStatus.ARCHIVED) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_ARCHIVE_DEFAULT, 400);
        }

        if (folder.status === status) {
            return this.toWorkspaceFolderResponse(folder, auth);
        }

        const previousState = this.folderSnapshot(folder);
        const oldStatus = folder.status;

        const updatedFolder = await this.workspaceFolderRepository.updateStatus(id, status, userObjectId);

        if (!updatedFolder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.logStatusChange(
                context ?? {},
                {
                    module: AppModule.WORKSPACE_FOLDER,
                    resourceId: updatedFolder._id.toString(),
                    resourceName: updatedFolder.name,
                },
                "status",
                oldStatus,
                status,
                `Workspace folder "${updatedFolder.name}" status changed from ${oldStatus} to ${status}.`,
            );
        } catch (error) {
            await this.workspaceFolderRepository.rollbackById(id, previousState);
            throw error;
        }

        return this.toWorkspaceFolderResponse(updatedFolder, auth);
    }

    async deleteWorkspaceFolder(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        this.validateAuditAction(AuditLogAction.DELETE);

        const userObjectId = this.getUserObjectId(updatedBy);

        const folder = await this.workspaceFolderRepository.findByIdIncludingDeleted(id);

        if (!folder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        const auth = await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            updatedBy,
            PermissionAction.DELETE,
            authorization,
        );

        if (folder.status === WorkspaceFolderStatus.DELETED) {
            throw new AppError(WorkspaceFolderMessages.ALREADY_DELETED, 400);
        }

        if (folder.isDefault) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_DELETE_DEFAULT_FOLDER, 400);
        }

        const previousState = this.folderSnapshot(folder);

        const deletedFolder = await this.workspaceFolderRepository.softDelete(id, userObjectId);

        if (!deletedFolder) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_DELETE_FOLDER, 409);
        }

        try {
            await this.auditLogService.logDelete(
                context ?? {},
                {
                    module: AppModule.WORKSPACE_FOLDER,
                    resourceId: deletedFolder._id.toString(),
                    resourceName: deletedFolder.name,
                },
                `Workspace folder "${deletedFolder.name}" was deleted successfully.`,
            );
        } catch (error) {
            await this.workspaceFolderRepository.rollbackById(id, previousState);
            throw error;
        }

        return this.toWorkspaceFolderResponse(deletedFolder, auth);
    }

    async restoreWorkspaceFolder(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceFolderResponse> {
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        this.validateAuditAction(AuditLogAction.RESTORE);

        const userObjectId = this.getUserObjectId(updatedBy);

        const folder = await this.workspaceFolderRepository.findByIdIncludingDeleted(id);

        if (!folder) {
            throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        }

        const auth = await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            updatedBy,
            PermissionAction.UPDATE,
            authorization,
        );

        if (folder.status !== WorkspaceFolderStatus.DELETED) {
            throw new AppError(WorkspaceFolderMessages.RESTORE_ONLY_DELETED, 400);
        }

        if (folder.isDefault) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_RESTORE_DEFAULT, 400);
        }
        if (folder.purgeAfter && folder.purgeAfter <= new Date()) {
            throw new AppError(WorkspaceFolderMessages.RESTORE_WINDOW_EXPIRED, 410);
        }

        const reservation = await this.subscriptionEntitlementService.assertCanRestoreFolder(updatedBy, id);
        try {
            const previousState = this.folderSnapshot(folder);

            const restoredFolder = await this.workspaceFolderRepository.restore(id, userObjectId);

            if (!restoredFolder) {
                throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
            }

            try {
                await this.auditLogService.log({
                    ...(context ?? {}),
                    action: AuditLogAction.RESTORE,
                    module: AppModule.WORKSPACE_FOLDER,
                    resourceId: restoredFolder._id.toString(),
                    resourceName: restoredFolder.name,
                    description: `Workspace folder "${restoredFolder.name}" was restored successfully.`,
                });
            } catch (error) {
                await this.workspaceFolderRepository.rollbackById(id, previousState);
                throw error;
            }

            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return this.toWorkspaceFolderResponse(restoredFolder, auth);
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
    }

    async permanentlyDeleteWorkspaceFolder(
        id: string,
        userId: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        this.validateAuditAction(AuditLogAction.DELETE);
        this.getObjectIdString(id, WorkspaceFolderMessages.NOT_FOUND);
        const folder = await this.workspaceFolderRepository.findByIdIncludingDeleted(id);
        if (!folder) throw new AppError(WorkspaceFolderMessages.NOT_FOUND, 404);
        await this.assertWorkspaceAccess(
            folder.workspaceId.toString(),
            userId,
            PermissionAction.DELETE,
            authorization,
        );
        if (folder.status !== WorkspaceFolderStatus.DELETED)
            throw new AppError(WorkspaceFolderMessages.PERMANENT_DELETE_REQUIRES_TRASH, 400);
        if (folder.isDefault) throw new AppError(WorkspaceFolderMessages.CANNOT_DELETE_DEFAULT_FOLDER, 400);
        return this.workspaceFolderRepository.runInTransaction(async (session) => {
            if (await this.workspaceFolderRepository.hasDependencies(id, session)) {
                throw new AppError(WorkspaceFolderMessages.HAS_DEPENDENCIES, 409);
            }
            const result = await this.workspaceFolderRepository.deleteTrashed(
                id,
                folder.workspaceId.toString(),
                session,
            );
            if (result.deletedCount !== 1)
                throw new AppError(WorkspaceFolderMessages.CANNOT_DELETE_FOLDER, 409);
            await this.auditLogService.logMany(
                [
                    {
                        ...context,
                        actorId: userId,
                        module: AppModule.WORKSPACE_FOLDER,
                        action: AuditLogAction.DELETE,
                        resourceId: id,
                        resourceName: folder.name,
                        description: `Workspace folder "${folder.name}" was permanently deleted.`,
                        metadata: { permanent: true, workspaceId: folder.workspaceId.toString() },
                    },
                ],
                session,
            );
            return { deletedFolders: result.deletedCount };
        });
    }

    private validateAuditAction(action: AuditLogAction): void {
        const moduleConfig = AuditLogConfig[AppModule.WORKSPACE_FOLDER];

        if (!moduleConfig || !moduleConfig.actions.includes(action)) {
            throw new AppError(
                `Action ${action} is not allowed for module ${AppModule.WORKSPACE_FOLDER}.`,
                400,
            );
        }
    }

    private folderSnapshot(folder: {
        workspaceId: Types.ObjectId | string;
        name: string;
        slug: string;
        description?: string | null;
        icon?: string | null;
        color?: string | null;
        position: number;
        isDefault: boolean;
        status: WorkspaceFolderStatus;
        updatedBy?: Types.ObjectId | null;
        deletedAt?: Date | null;
        deletedBy?: Types.ObjectId | null;
        purgeAfter?: Date | null;
        updatedAt?: Date;
    }): Record<string, unknown> {
        return {
            workspaceId: folder.workspaceId,
            name: folder.name,
            slug: folder.slug,
            description: folder.description ?? null,
            icon: folder.icon ?? null,
            color: folder.color ?? null,
            position: folder.position,
            isDefault: folder.isDefault,
            status: folder.status,
            updatedBy: folder.updatedBy ?? null,
            deletedAt: folder.deletedAt ?? null,
            deletedBy: folder.deletedBy ?? null,
            purgeAfter: folder.purgeAfter ?? null,
            updatedAt: folder.updatedAt,
        };
    }

    private toWorkspaceFolderResponse(
        folder: {
            _id: Types.ObjectId | string;
            workspaceId: Types.ObjectId | string;
            name: string;
            slug: string;
            description?: string | null;
            icon?: string | null;
            color?: string | null;
            position: number;
            isDefault: boolean;
            status: WorkspaceFolderStatus;
            createdBy?: Types.ObjectId | string | null;
            updatedBy?: Types.ObjectId | string | null;
            deletedAt?: Date | null;
            deletedBy?: Types.ObjectId | null;
            purgeAfter?: Date | null;
            createdAt?: Date;
            updatedAt?: Date;
        },
        auth: IWorkspaceAuthorizationContext,
        summary?: IWorkspaceFolderSummary,
    ): IWorkspaceFolderResponse {
        const can = (action: PermissionAction) =>
            permissionAuthorizationService.canAccessFolder(auth, action);
        const deleted = folder.status === WorkspaceFolderStatus.DELETED;
        const editable = !deleted && can(PermissionAction.UPDATE);
        return {
            id: this.resolveId(folder._id),
            workspaceId: this.resolveId(folder.workspaceId),
            name: folder.name,
            slug: folder.slug,
            description: folder.description ?? null,
            icon: folder.icon ?? null,
            color: folder.color ?? null,
            position: folder.position,
            isDefault: folder.isDefault,
            status: folder.status,
            ...(summary !== undefined ? { summary } : {}),
            allowedActions: {
                canView: can(PermissionAction.READ),
                canCreate: can(PermissionAction.CREATE),
                canEdit: editable,
                canChangeStatus: editable,
                canArchive: editable && !folder.isDefault && folder.status !== WorkspaceFolderStatus.ARCHIVED,
                canUnarchive: editable && folder.status === WorkspaceFolderStatus.ARCHIVED,
                canTrash: !deleted && !folder.isDefault && can(PermissionAction.DELETE),
                canRestore:
                    deleted &&
                    !folder.isDefault &&
                    can(PermissionAction.UPDATE) &&
                    (!folder.purgeAfter || folder.purgeAfter > new Date()),
                canPermanentlyDelete: deleted && !folder.isDefault && can(PermissionAction.DELETE),
            },
            createdBy: folder.createdBy ? this.resolveId(folder.createdBy) : null,
            updatedBy: folder.updatedBy ? this.resolveId(folder.updatedBy) : null,
            deletedAt: folder.deletedAt ?? null,
            deletedBy: folder.deletedBy?.toString() ?? null,
            purgeAfter: folder.purgeAfter ?? null,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        };
    }

    private getUserObjectId(userId: string): Types.ObjectId {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(WorkspaceFolderMessages.INVALID_USER_ID, 401);
        }

        return new Types.ObjectId(userId);
    }

    private getObjectIdString(value: Types.ObjectId | string | undefined, message: string): string {
        const id = value instanceof Types.ObjectId ? value.toString() : String(value ?? "");

        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(message, 400);
        }

        return id;
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

    private async assertWorkspaceAccess(
        workspaceId: string,
        userId: string,
        action: PermissionAction,
        authorization?: IWorkspaceAuthorizationContext,
    ) {
        this.getUserObjectId(userId);
        if (authorization && (authorization.userId !== userId || authorization.workspaceId !== workspaceId)) {
            throw new AppError(WorkspaceFolderMessages.CANNOT_ACCESS_WORKSPACE, 403);
        }
        const auth =
            authorization?.workspaceStatus !== undefined
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(userId, workspaceId);
        permissionAuthorizationService.assertWorkspaceState(auth.workspaceStatus!);
        permissionAuthorizationService.assertFolderAccess(auth, action);
        if (action === PermissionAction.CREATE || action === PermissionAction.UPDATE) {
            await this.subscriptionEntitlementService.assertWorkspaceFeature(
                workspaceId,
                FeatureCode.FOLDERS,
            );
            if (!auth.isOwner)
                await this.subscriptionEntitlementService.assertWorkspaceFeature(
                    workspaceId,
                    FeatureCode.SHARED_FOLDERS,
                );
        }
        return auth;
    }

    private getDuplicateMessage(error: unknown): string {
        if (typeof error === "object" && error !== null) {
            if ("keyPattern" in error) {
                const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern;

                if (keyPattern && "slug" in keyPattern) {
                    return WorkspaceFolderMessages.SLUG_ALREADY_EXISTS;
                }

                if (keyPattern && "isDefault" in keyPattern) {
                    return WorkspaceFolderMessages.DEFAULT_FOLDER_EXISTS;
                }
            }

            if ("message" in error) {
                const msg = String((error as { message?: unknown }).message);
                if (msg.includes("uniq_workspace_folder_slug")) {
                    return WorkspaceFolderMessages.SLUG_ALREADY_EXISTS;
                }
                if (msg.includes("uniq_default_folder_per_workspace")) {
                    return WorkspaceFolderMessages.DEFAULT_FOLDER_EXISTS;
                }
            }
        }

        return WorkspaceFolderMessages.ALREADY_EXISTS;
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
