import { subscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import mongoose, { Types } from "mongoose";
import { StickyNoteColumnColor, StickyNoteColumnType } from "../constants/stickyNoteColumn.enums.js";
import {
    DEFAULT_STICKY_NOTE_COLUMNS,
    STICKY_NOTE_COLUMN_CONSTANTS,
} from "../constants/stickyNoteColumn.constants.js";
import { StickyNoteColumnMessages } from "../constants/stickyNoteColumn.messages.js";
import type {
    IStickyNoteColumn,
    IStickyNoteColumnCreate,
    IStickyNoteColumnItemReorder,
    IStickyNoteColumnReorder,
    IStickyNoteColumnResponse,
    IStickyNoteColumnUpdate,
} from "../interfaces/stickyNoteColumn.interface.js";
import { StickyNoteColumnValidation } from "../validations/stickyNoteColumn.validation.js";
import { StickyNoteColumnRepository } from "../repositories/stickyNoteColumn.repository.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { WorkspaceFolderStatus } from "../../workspaceFolders/constants/workspaceFolder.enums.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import {
    permissionAuthorizationService,
    type IWorkspaceAuthorizationContext,
} from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { AuditLogConfig } from "../../../config/auditlog.config.js";
import { RankUtil } from "../../../utils/rank.util.js";

export class StickyNoteColumnService {
    private readonly stickyNoteColumnRepository: StickyNoteColumnRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.stickyNoteColumnRepository = new StickyNoteColumnRepository();
        this.auditLogService = new AuditLogService();
    }

    async createStickyNoteColumn(
        data: IStickyNoteColumnCreate,
        createdBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse> {
        this.validateAuditAction(AuditLogAction.CREATE);
        const userObjectId = this.getUserObjectId(createdBy);
        const workspaceId = this.toIdString(data.workspaceId, StickyNoteColumnMessages.INVALID_WORKSPACE_ID);
        const workspaceFolderId = this.toIdString(
            data.workspaceFolderId,
            StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID,
        );

        await this.authorizeWorkspace(workspaceId, createdBy, PermissionAction.CREATE, authorization);
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);
        await subscriptionEntitlementService.assertWorkspaceFeature(workspaceId, FeatureCode.KANBAN);

        const [columnCount, highestPosition, highestRank] = await Promise.all([
            this.stickyNoteColumnRepository.countByWorkspaceFolder(workspaceId, workspaceFolderId),
            this.stickyNoteColumnRepository.getHighestPosition(workspaceId, workspaceFolderId),
            this.stickyNoteColumnRepository.getHighestRank(workspaceId, workspaceFolderId),
        ]);

        if (columnCount >= STICKY_NOTE_COLUMN_CONSTANTS.MAX_COLUMNS_PER_FOLDER) {
            throw new AppError(StickyNoteColumnMessages.MAX_COLUMNS_REACHED, 409);
        }

        const normalizedName = StickyNoteColumnValidation.normalizeName(data.name);
        const rank =
            data.rank && RankUtil.isValidRank(data.rank)
                ? data.rank
                : highestRank
                  ? (RankUtil.generateRankAfter(highestRank) ?? RankUtil.generateInitialRank())
                  : RankUtil.generateInitialRank();

        const position =
            data.position !== undefined && StickyNoteColumnValidation.isValidPosition(data.position)
                ? data.position
                : highestPosition + 1;

        try {
            const column = await this.stickyNoteColumnRepository.create({
                workspaceId: new Types.ObjectId(workspaceId),
                workspaceFolderId: new Types.ObjectId(workspaceFolderId),
                name: normalizedName,
                type: StickyNoteColumnType.CUSTOM,
                color: data.color ?? StickyNoteColumnColor.YELLOW,
                position,
                rank,
                isSystem: false,
                createdBy: userObjectId,
                updatedBy: userObjectId,
            });

            try {
                await this.auditLogService.logCreate(
                    context ?? {},
                    {
                        module: AppModule.STICKY_NOTE_COLUMN,
                        resourceId: column._id.toString(),
                        resourceName: column.name,
                    },
                    `Sticky note column "${column.name}" was created successfully.`,
                );
            } catch (error) {
                await this.stickyNoteColumnRepository.hardDeleteById(column._id.toString());
                throw error;
            }

            return this.toStickyNoteColumnResponse(column);
        } catch (error) {
            this.throwIfDuplicate(error);
            throw error;
        }
    }

    async createDefaultColumns(
        workspaceId: string,
        workspaceFolderId: string,
        createdBy: string,
    ): Promise<IStickyNoteColumnResponse[]> {
        const userObjectId = this.getUserObjectId(createdBy);
        this.assertObjectId(workspaceId, StickyNoteColumnMessages.INVALID_WORKSPACE_ID);
        this.assertObjectId(workspaceFolderId, StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID);

        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        const existingColumns = await this.stickyNoteColumnRepository.findAllByWorkspaceFolder(
            workspaceId,
            workspaceFolderId,
        );
        if (existingColumns.length > 0) {
            return existingColumns.map((c) => this.toStickyNoteColumnResponse(c));
        }

        const columnsToCreate = DEFAULT_STICKY_NOTE_COLUMNS.map((col) => ({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
            name: col.name,
            type: col.type,
            color: col.color,
            position: col.position,
            rank: col.rank,
            isSystem: col.isSystem,
            createdBy: userObjectId,
            updatedBy: userObjectId,
        }));

        try {
            const created = await this.stickyNoteColumnRepository.createMany(columnsToCreate);
            return created.map((c) => this.toStickyNoteColumnResponse(c));
        } catch (error) {
            if (!this.isDuplicateKeyError(error)) throw error;
            const current = await this.stickyNoteColumnRepository.findAllByWorkspaceFolder(
                workspaceId,
                workspaceFolderId,
            );
            return current.map((c) => this.toStickyNoteColumnResponse(c));
        }
    }

    async getStickyNoteColumnById(
        id: string,
        userId?: string,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse> {
        this.assertObjectId(id, StickyNoteColumnMessages.INVALID_ID);
        const column = await this.stickyNoteColumnRepository.findById(id);
        if (!column) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);

        const workspaceId = column.workspaceId.toString();
        const workspaceFolderId = column.workspaceFolderId.toString();

        if (userId) {
            await this.authorizeWorkspace(workspaceId, userId, PermissionAction.READ, authorization);
        }
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        return this.toStickyNoteColumnResponse(column);
    }

    async getStickyNoteColumns(
        workspaceId: string,
        workspaceFolderId: string,
        userId?: string,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse[]> {
        this.assertObjectId(workspaceId, StickyNoteColumnMessages.INVALID_WORKSPACE_ID);
        this.assertObjectId(workspaceFolderId, StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID);

        if (userId) {
            await this.authorizeWorkspace(workspaceId, userId, PermissionAction.READ, authorization);
        }
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        const columns = await this.stickyNoteColumnRepository.findAllByWorkspaceFolder(
            workspaceId,
            workspaceFolderId,
        );
        return columns.map((c) => this.toStickyNoteColumnResponse(c));
    }

    async updateStickyNoteColumn(
        id: string,
        data: IStickyNoteColumnUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse> {
        this.validateAuditAction(AuditLogAction.UPDATE);
        const userObjectId = this.getUserObjectId(updatedBy);
        this.assertObjectId(id, StickyNoteColumnMessages.INVALID_ID);

        const column = await this.stickyNoteColumnRepository.findById(id);
        if (!column) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);

        const workspaceId = column.workspaceId.toString();
        const workspaceFolderId = column.workspaceFolderId.toString();

        await this.authorizeWorkspace(workspaceId, updatedBy, PermissionAction.UPDATE, authorization);
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        if (
            !StickyNoteColumnValidation.hasOnlyAllowedFields(data as unknown as Record<string, unknown>, [
                "name",
                "color",
                "rank",
            ])
        ) {
            throw new AppError(StickyNoteColumnMessages.UNSUPPORTED_FIELDS, 400);
        }

        const changes: Array<{ field: string; oldValue?: unknown; newValue?: unknown }> = [];
        const updateData: Partial<IStickyNoteColumn> = {};

        if (data.name !== undefined) {
            const normalizedName = StickyNoteColumnValidation.normalizeName(data.name);
            if (!StickyNoteColumnValidation.isValidName(normalizedName)) {
                throw new AppError(StickyNoteColumnMessages.INVALID_NAME, 400);
            }
            if (normalizedName !== column.name) {
                updateData.name = normalizedName;
                changes.push({ field: "name", oldValue: column.name, newValue: normalizedName });
            }
        }

        if (data.color !== undefined) {
            if (!StickyNoteColumnValidation.isValidColor(data.color)) {
                throw new AppError(StickyNoteColumnMessages.INVALID_COLOR, 400);
            }
            if (data.color !== column.color) {
                updateData.color = data.color;
                changes.push({ field: "color", oldValue: column.color, newValue: data.color });
            }
        }

        if (data.rank !== undefined && data.rank !== column.rank) {
            updateData.rank = data.rank;
            changes.push({ field: "rank", oldValue: column.rank, newValue: data.rank });
        }

        if (changes.length === 0) {
            return this.toStickyNoteColumnResponse(column);
        }

        try {
            const updatedColumn = await this.stickyNoteColumnRepository.updateById(id, {
                ...updateData,
                updatedBy: userObjectId,
            });
            if (!updatedColumn) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);

            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE_COLUMN,
                    resourceId: updatedColumn._id.toString(),
                    resourceName: updatedColumn.name,
                },
                `Sticky note column "${updatedColumn.name}" was updated successfully.`,
                changes,
            );

            return this.toStickyNoteColumnResponse(updatedColumn);
        } catch (error) {
            this.throwIfDuplicate(error);
            throw error;
        }
    }

    async reorderStickyNoteColumn(
        id: string,
        data: IStickyNoteColumnItemReorder,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse> {
        this.validateAuditAction(AuditLogAction.UPDATE);
        const userObjectId = this.getUserObjectId(updatedBy);
        this.assertObjectId(id, StickyNoteColumnMessages.INVALID_ID);

        const movedColumn = await this.stickyNoteColumnRepository.findById(id);
        if (!movedColumn) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);

        const workspaceId = movedColumn.workspaceId.toString();
        const workspaceFolderId = movedColumn.workspaceFolderId.toString();

        await this.authorizeWorkspace(workspaceId, updatedBy, PermissionAction.UPDATE, authorization);
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        const [beforeColumn, afterColumn] = await Promise.all([
            data.beforeId ? this.stickyNoteColumnRepository.findById(data.beforeId) : null,
            data.afterId ? this.stickyNoteColumnRepository.findById(data.afterId) : null,
        ]);

        if (data.beforeId && !beforeColumn) {
            throw new AppError(StickyNoteColumnMessages.BEFORE_COLUMN_NOT_FOUND, 404);
        }
        if (beforeColumn && beforeColumn.workspaceFolderId.toString() !== workspaceFolderId) {
            throw new AppError(StickyNoteColumnMessages.COLUMN_WORKSPACE_MISMATCH, 400);
        }
        if (data.afterId && !afterColumn) {
            throw new AppError(StickyNoteColumnMessages.AFTER_COLUMN_NOT_FOUND, 404);
        }
        if (afterColumn && afterColumn.workspaceFolderId.toString() !== workspaceFolderId) {
            throw new AppError(StickyNoteColumnMessages.COLUMN_WORKSPACE_MISMATCH, 400);
        }

        let beforeRank = beforeColumn?.rank;
        let afterRank = afterColumn?.rank;

        // Normalize if ranks are in an inconsistent state
        if (beforeColumn && afterColumn && (!beforeRank || !afterRank || beforeRank >= afterRank)) {
            await this.stickyNoteColumnRepository.normalizeRanks(workspaceId, workspaceFolderId);
            const [refBefore, refAfter] = await Promise.all([
                this.stickyNoteColumnRepository.findById(data.beforeId!),
                this.stickyNoteColumnRepository.findById(data.afterId!),
            ]);
            beforeRank = refBefore?.rank;
            afterRank = refAfter?.rank;
        }

        let newRank: string | null;
        if (!beforeColumn && !afterColumn) {
            const highestRank = await this.stickyNoteColumnRepository.getHighestRank(
                workspaceId,
                workspaceFolderId,
            );
            newRank = highestRank ? RankUtil.generateRankAfter(highestRank) : RankUtil.generateInitialRank();
        } else {
            newRank = RankUtil.generateRankBetween(beforeRank, afterRank);
        }

        if (!newRank) {
            await this.stickyNoteColumnRepository.normalizeRanks(workspaceId, workspaceFolderId);
            const [refBefore, refAfter] = await Promise.all([
                data.beforeId ? this.stickyNoteColumnRepository.findById(data.beforeId) : null,
                data.afterId ? this.stickyNoteColumnRepository.findById(data.afterId) : null,
            ]);
            newRank =
                RankUtil.generateRankBetween(refBefore?.rank, refAfter?.rank) ??
                RankUtil.generateInitialRank();
        }

        const updatedColumn = await this.stickyNoteColumnRepository.updateById(id, {
            rank: newRank,
            updatedBy: userObjectId,
        });
        if (!updatedColumn) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);

        await this.auditLogService.logUpdate(
            context ?? {},
            { module: AppModule.STICKY_NOTE_COLUMN, resourceId: id, resourceName: updatedColumn.name },
            `Sticky note column "${updatedColumn.name}" was reordered successfully.`,
            [{ field: "rank", oldValue: movedColumn.rank, newValue: newRank }],
        );

        return this.toStickyNoteColumnResponse(updatedColumn);
    }

    async reorderStickyNoteColumns(
        data: IStickyNoteColumnReorder,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IStickyNoteColumnResponse[]> {
        this.validateAuditAction(AuditLogAction.UPDATE);
        const userObjectId = this.getUserObjectId(updatedBy);
        const workspaceId = this.toIdString(data.workspaceId, StickyNoteColumnMessages.INVALID_WORKSPACE_ID);
        const workspaceFolderId = this.toIdString(
            data.workspaceFolderId,
            StickyNoteColumnMessages.INVALID_WORKSPACE_FOLDER_ID,
        );
        const requestedIds = data.columnIds.map((id) =>
            this.toIdString(id, StickyNoteColumnMessages.INVALID_COLUMN_IDS),
        );

        await this.authorizeWorkspace(workspaceId, updatedBy, PermissionAction.UPDATE, authorization);
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        const columns = await this.stickyNoteColumnRepository.findAllByWorkspaceFolder(
            workspaceId,
            workspaceFolderId,
        );
        const existingIds = columns.map((c) => c._id.toString());

        if (requestedIds.length !== existingIds.length) {
            throw new AppError(StickyNoteColumnMessages.REORDER_MUST_INCLUDE_ALL_COLUMNS, 400);
        }

        const existingIdSet = new Set(existingIds);
        if (requestedIds.some((id) => !existingIdSet.has(id))) {
            throw new AppError(StickyNoteColumnMessages.COLUMN_WORKSPACE_MISMATCH, 400);
        }

        const updatedColumns = await this.stickyNoteColumnRepository.reorder(
            workspaceId,
            workspaceFolderId,
            requestedIds,
            userObjectId,
        );

        await this.auditLogService.logUpdate(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_COLUMN,
                resourceId: workspaceFolderId,
                resourceName: "Sticky note columns",
            },
            "Sticky note columns were reordered successfully.",
            [{ field: "columnOrder", oldValue: existingIds, newValue: requestedIds }],
        );

        return updatedColumns.map((c) => this.toStickyNoteColumnResponse(c));
    }

    async deleteStickyNoteColumn(
        id: string,
        updatedBy: string,
        context?: IAuditLogContext,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<void> {
        this.validateAuditAction(AuditLogAction.DELETE);
        const userObjectId = this.getUserObjectId(updatedBy);
        this.assertObjectId(id, StickyNoteColumnMessages.INVALID_ID);

        const column = await this.stickyNoteColumnRepository.findById(id);
        if (!column) throw new AppError(StickyNoteColumnMessages.NOT_FOUND, 404);
        if (column.isSystem) throw new AppError(StickyNoteColumnMessages.CANNOT_DELETE_SYSTEM_COLUMN, 400);

        const workspaceId = column.workspaceId.toString();
        const workspaceFolderId = column.workspaceFolderId.toString();

        await this.authorizeWorkspace(workspaceId, updatedBy, PermissionAction.DELETE, authorization);
        await this.assertHierarchyAvailable(workspaceId, workspaceFolderId);

        const todoColumn = await this.stickyNoteColumnRepository.findSystemByType(
            workspaceId,
            workspaceFolderId,
            StickyNoteColumnType.TODO,
        );
        if (!todoColumn) throw new AppError(StickyNoteColumnMessages.DEFAULT_TODO_COLUMN_NOT_FOUND, 409);

        await this.stickyNoteColumnRepository.runInTransactionIfSupported(async (session) => {
            await StickyNoteModel.updateMany(
                { columnId: column._id },
                { $set: { columnId: todoColumn._id, updatedBy: userObjectId } },
                session ? { session } : {},
            );
            await this.stickyNoteColumnRepository.deleteById(id, session);
        });

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_COLUMN,
                resourceId: column._id.toString(),
                resourceName: column.name,
            },
            `Sticky note column "${column.name}" was deleted successfully.`,
        );
    }

    private async authorizeWorkspace(
        workspaceId: string,
        userId: string,
        action: PermissionAction | PermissionAction[],
        authorization?: IWorkspaceAuthorizationContext,
        allowTrashed = false,
        allowInactive = false,
    ): Promise<IWorkspaceAuthorizationContext> {
        this.getUserObjectId(userId);
        if (!Types.ObjectId.isValid(workspaceId)) {
            throw new AppError(StickyNoteColumnMessages.INVALID_WORKSPACE_ID, 400);
        }

        if (authorization) {
            if (authorization.userId !== userId || authorization.workspaceId !== workspaceId) {
                throw new AppError(StickyNoteColumnMessages.CANNOT_ACCESS_WORKSPACE, 403);
            }
        }

        const auth =
            authorization?.workspaceStatus !== undefined
                ? authorization
                : await permissionAuthorizationService.resolveWorkspaceAuthorization(
                      userId,
                      workspaceId,
                      allowTrashed,
                      allowInactive,
                  );

        permissionAuthorizationService.assertWorkspaceState(
            auth.workspaceStatus!,
            allowTrashed,
            allowInactive,
        );
        permissionAuthorizationService.assertPermission(auth, PermissionModule.NOTES, action);
        if (
            (Array.isArray(action) ? action : [action]).some(
                (value) => value !== PermissionAction.READ && value !== PermissionAction.DELETE,
            )
        )
            await subscriptionEntitlementService.assertWorkspaceFeature(workspaceId, FeatureCode.KANBAN);
        return auth;
    }

    private toStickyNoteColumnResponse(column: {
        _id?: Types.ObjectId | string;
        id?: string;
        workspaceId: Types.ObjectId | string;
        workspaceFolderId: Types.ObjectId | string;
        name: string;
        type: StickyNoteColumnType;
        color: StickyNoteColumnColor;
        position: number;
        rank?: string;
        isSystem: boolean;
        createdBy: Types.ObjectId | string;
        updatedBy?: Types.ObjectId | string | null;
        createdAt?: Date;
        updatedAt?: Date;
    }): IStickyNoteColumnResponse {
        return {
            id: this.resolveId(column._id ?? column.id),
            workspaceId: this.resolveId(column.workspaceId),
            workspaceFolderId: this.resolveId(column.workspaceFolderId),
            name: column.name,
            type: column.type,
            color: column.color,
            position: column.position,
            rank: column.rank ?? "",
            isSystem: column.isSystem,
            createdBy: this.resolveId(column.createdBy),
            updatedBy: column.updatedBy ? this.resolveId(column.updatedBy) : null,
            createdAt: column.createdAt,
            updatedAt: column.updatedAt,
        };
    }

    private async assertHierarchyAvailable(workspaceId: string, workspaceFolderId: string): Promise<void> {
        const [workspace, folder] = await Promise.all([
            WorkspaceModel.findById(workspaceId).select("_id status").lean(),
            WorkspaceFolderModel.findById(workspaceFolderId).select("_id workspaceId status").lean(),
        ]);

        if (!workspace) throw new AppError(StickyNoteColumnMessages.WORKSPACE_NOT_FOUND, 404);
        if (isWorkspaceTrashed(workspace.status)) {
            throw new AppError(StickyNoteColumnMessages.WORKSPACE_DELETED, 400);
        }
        if (!folder) throw new AppError(StickyNoteColumnMessages.WORKSPACE_FOLDER_NOT_FOUND, 404);
        if (folder.workspaceId.toString() !== workspaceId) {
            throw new AppError(StickyNoteColumnMessages.WORKSPACE_FOLDER_MISMATCH, 400);
        }
        if (folder.status === WorkspaceFolderStatus.DELETED) {
            throw new AppError(StickyNoteColumnMessages.WORKSPACE_FOLDER_DELETED, 409);
        }
    }

    private getUserObjectId(userId: string): Types.ObjectId {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteColumnMessages.INVALID_USER_ID, 401);
        }
        return new Types.ObjectId(userId);
    }

    private toIdString(value: Types.ObjectId | string, message: string): string {
        const id = value instanceof Types.ObjectId ? value.toString() : String(value ?? "");
        this.assertObjectId(id, message);
        return id;
    }

    private assertObjectId(id: string, message: string): void {
        if (!Types.ObjectId.isValid(id)) throw new AppError(message, 400);
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

    private validateAuditAction(action: AuditLogAction): void {
        const moduleConfig = AuditLogConfig[AppModule.STICKY_NOTE_COLUMN];
        if (!moduleConfig || !moduleConfig.actions.includes(action)) {
            throw new AppError(
                `Action ${action} is not allowed for module ${AppModule.STICKY_NOTE_COLUMN}.`,
                400,
            );
        }
    }

    private throwIfDuplicate(error: unknown): void {
        if (this.isDuplicateKeyError(error)) {
            throw new AppError(StickyNoteColumnMessages.DUPLICATE_NAME, 409);
        }
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
