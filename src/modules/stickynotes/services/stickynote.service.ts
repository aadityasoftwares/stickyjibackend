import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import { Types } from "mongoose";
import {
    StickyNoteBackgroundPattern,
    StickyNoteColor,
    StickyNotePriority,
    StickyNoteOverdueSort,
    StickyNoteShape,
    StickyNoteStatus,
    StickyNoteVariant,
} from "../constants/stickyNote.enums.js";
import { StickyNoteMessages } from "../constants/stickyNote.messages.js";
import { StickyNoteValidation } from "../validations/stickyNote.validation.js";
import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type {
    IStickyNote,
    IStickyNoteRecord,
    IStickyNoteCreate,
    IStickyNoteDetailResponse,
    IStickyNoteFilter,
    IStickyNoteReorder,
    IStickyNoteUpdate,
    IStickyNoteOverdueFilter,
    IBringStickyNotesToTodayResult,
} from "../interfaces/stickyNote.interface.js";
import { StickyNoteRepository } from "../repositories/stickyNote.repository.js";
import { StickyNoteDateService } from "./stickyNoteDate.service.js";
import { StickyNotePurgeService } from "./stickyNotePurge.service.js";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import { RankUtil } from "../../../utils/rank.util.js";
import { StickyNoteAssigneeService } from "../../stickynotesassignees/services/stickyNoteAssignee.service.js";
import {
    mapStickyNoteDetail,
    mapStickyNoteListItem,
    mapStickyNoteOverdueListItem,
} from "../utils/stickyNote.mapper.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { validateBringStickyNoteIds } from "../validations/overdueStickyNotes.validation.js";
import { permissionAuthorizationService } from "../../permissions/services/permissionAuthorization.service.js";
import {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} from "../../permissions/constants/permission.enums.js";

import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";

export class StickyNoteService {
    private readonly stickyNoteRepository: StickyNoteRepository;
    private readonly auditLogService: AuditLogService;
    private readonly stickyNoteDateService: StickyNoteDateService;
    private readonly stickyNotePurgeService: StickyNotePurgeService;
    private readonly stickyNoteAssigneeService: StickyNoteAssigneeService;
    private readonly workspaceRepository = new WorkspaceRepository();
    private readonly subscriptionEntitlementService: SubscriptionEntitlementService;

    constructor() {
        this.stickyNoteRepository = new StickyNoteRepository();
        this.auditLogService = new AuditLogService();
        this.stickyNoteDateService = new StickyNoteDateService();
        this.stickyNotePurgeService = new StickyNotePurgeService();
        this.stickyNoteAssigneeService = new StickyNoteAssigneeService();
        this.subscriptionEntitlementService = new SubscriptionEntitlementService();
    }

    async getOverdueStickyNotes(filters: IStickyNoteOverdueFilter, userId: string) {
        if (!Types.ObjectId.isValid(userId)) throw new AppError(StickyNoteMessages.INVALID_USER_ID, 401);
        const page = filters.page ?? STICKY_NOTE_CONSTANTS.OVERDUE.DEFAULT_PAGE;
        const limit = Math.min(
            filters.limit ?? STICKY_NOTE_CONSTANTS.OVERDUE.DEFAULT_LIMIT,
            STICKY_NOTE_CONSTANTS.OVERDUE.MAX_LIMIT,
        );
        const [today, workspaceIds] = await Promise.all([
            this.stickyNoteDateService.getTodayDateKey(userId),
            this.workspaceRepository.findAccessibleIds(userId, filters.workspaceId),
        ]);
        const result = await this.stickyNoteRepository.findOverdue(workspaceIds, today, {
            ...filters,
            page,
            limit,
            sort: filters.sort ?? StickyNoteOverdueSort.OLDEST_FIRST,
        });
        const total = result.byColumn.reduce((sum, column) => sum + column.count, 0);
        return {
            data: {
                today,
                total,
                byColumn: result.byColumn,
                notes: result.notes.map((note) =>
                    mapStickyNoteOverdueListItem(
                        note,
                        StickyNoteDateService.getCalendarDaysBetween(note.noteDate, today),
                    ),
                ),
            },
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async bringOverdueStickyNotesToToday(
        stickyNoteIds: string[],
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IBringStickyNotesToTodayResult> {
        if (!Types.ObjectId.isValid(userId)) throw new AppError(StickyNoteMessages.INVALID_USER_ID, 401);
        const ids = validateBringStickyNoteIds(stickyNoteIds);
        const today = await this.stickyNoteDateService.getTodayDateKey(userId);
        return this.stickyNoteRepository.runInTransactionIfSupported(async (session) => {
            // Keep all operations sequential. On a replica set they share a transaction;
            // standalone MongoDB deployments run the same flow without a session.
            const workspaceIds = await this.workspaceRepository.findAccessibleIds(userId, undefined, session);
            const notes = await this.stickyNoteRepository.findOverdueByIds(workspaceIds, today, ids, session);
            if (notes.length > 0) {
                const result = await this.stickyNoteRepository.bulkUpdateOverdueNoteDate(
                    notes,
                    today,
                    userId,
                    session,
                );
                if (result.matchedCount !== notes.length)
                    throw new AppError(StickyNoteMessages.OVERDUE_UPDATE_CONFLICT, 409);
                await this.auditLogService.logMany(
                    notes.map((note) => ({
                        ...context,
                        actorId: userId,
                        action: AuditLogAction.UPDATE,
                        module: AppModule.STICKY_NOTE,
                        resourceId: note._id,
                        resourceName: note.title || "Sticky Note",
                        description: `Overdue sticky note ${note.title || note._id.toString()} was rescheduled to today.`,
                        changes: [{ field: "noteDate", oldValue: note.noteDate, newValue: today }],
                    })),
                    session,
                );
            }
            const updatedIds = new Set(notes.map((note) => note._id.toString()));
            const skippedNotes: IBringStickyNotesToTodayResult["skippedNotes"] = ids
                .filter((id) => !updatedIds.has(id))
                .map((id) => ({ id, reason: "NOT_OVERDUE_OR_UNAVAILABLE" }));
            return {
                today,
                requested: ids.length,
                updated: notes.length,
                skipped: skippedNotes.length,
                skippedNotes,
            };
        });
    }

    async createStickyNote(data: IStickyNoteCreate, createdBy: string, context?: IAuditLogContext) {
        const normalizedTitle =
            data.title !== undefined ? StickyNoteValidation.normalizeTitle(data.title) : "";
        const normalizedContent = StickyNoteValidation.normalizeContent(data.content);
        const workspaceId = String(data.workspaceId);
        const workspaceFolderId = String(data.workspaceFolderId);
        const columnId = String(data.columnId);

        const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
            createdBy,
            workspaceId,
        );
        permissionAuthorizationService.assertPermission(
            auth,
            PermissionModule.NOTES,
            PermissionAction.CREATE,
        );

        await this.assertStickyNoteHierarchy(workspaceId, workspaceFolderId, columnId);

        const reservation = await this.subscriptionEntitlementService.assertCanCreateStickyNote(
            createdBy,
            workspaceId,
        );

        try {
            const [position, rank, stickyNoteNumber] = await Promise.all([
                data.position !== undefined
                    ? Promise.resolve(data.position)
                    : this.stickyNoteRepository.getNextPositionByColumn(columnId),
                data.rank !== undefined && RankUtil.isValidRank(data.rank)
                    ? Promise.resolve(data.rank)
                    : this.stickyNoteRepository.getNextRankByColumn(columnId),
                this.stickyNoteRepository.getNextStickyNoteNumber(workspaceId),
            ]);

            const stickyNote = await this.stickyNoteRepository.create({
                workspaceId: new Types.ObjectId(workspaceId),
                workspaceFolderId: new Types.ObjectId(workspaceFolderId),
                columnId: new Types.ObjectId(columnId),
                stickyNoteNumber,
                title: normalizedTitle,
                content: normalizedContent,
                color: data.color ?? StickyNoteColor.YELLOW,
                priority: data.priority ?? StickyNotePriority.NONE,
                shape: data.shape ?? StickyNoteShape.SQUARE,
                variant: data.variant ?? StickyNoteVariant.PLAIN,
                backgroundPattern: data.backgroundPattern ?? StickyNoteBackgroundPattern.NONE,
                position,
                rank,
                status: StickyNoteStatus.ACTIVE,
                noteDate:
                    data.noteDate !== undefined
                        ? this.stickyNoteDateService.normalizeNullableDateKey(data.noteDate)
                        : null,
                createdBy: new Types.ObjectId(createdBy),
                updatedBy: new Types.ObjectId(createdBy),
                archivedAt: null,
                archivedBy: null,
                deletedAt: null,
                deletedBy: null,
                purgeAfter: null,
            });

            await this.auditLogService.logCreate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE,
                    resourceId: stickyNote._id.toString(),
                    resourceName: stickyNote.title || "Sticky Note",
                },
                `Sticky note ${stickyNote.title || stickyNote._id.toString()} was created successfully.`,
            );

            if (data.assigneeIds?.length) {
                await this.stickyNoteAssigneeService.syncStickyNoteAssignees(
                    stickyNote._id.toString(),
                    { assigneeIds: data.assigneeIds },
                    createdBy,
                    context,
                );
            }

            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return this.resolveNoteDetailResponse(stickyNote, createdBy);
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
    }

    async getStickyNoteById(id: string, userId?: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findById(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        if (userId) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                userId,
                stickyNote.workspaceId.toString(),
            );
            permissionAuthorizationService.assertNoteAccess(auth, stickyNote, PermissionAction.READ);
        }
        return this.resolveNoteDetailResponse(stickyNote, userId);
    }

    async getStickyNotes(filters: IStickyNoteFilter = {}, userId: string) {
        if (filters.sortBy && !StickyNoteValidation.isValidSortField(filters.sortBy)) {
            throw new AppError("Invalid sticky note sort field.", 400);
        }
        if (filters.workspaceId) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                userId,
                filters.workspaceId.toString(),
            );
            const access = permissionAuthorizationService.assertPermission(
                auth,
                PermissionModule.NOTES,
                PermissionAction.READ,
            );
            if (access === PermissionAccess.OWN) {
                filters.createdBy = userId;
            }
        }
        const dateFilter = await this.stickyNoteDateService.resolveFilter(
            { noteDate: filters.noteDate, datePreset: filters.datePreset },
            userId,
        );
        const page = filters.page && filters.page > 0 ? filters.page : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 100) : 20;

        const result = await this.stickyNoteRepository.findAll({
            ...filters,
            ...dateFilter,
            page,
            limit,
        });

        if (result.data.length === 0) {
            return {
                data: [],
                pagination: result.pagination,
            };
        }

        const noteIds: string[] = [];
        const folderIdsSet = new Set<string>();
        const creatorUserIdsSet = new Set<string>();

        for (const note of result.data) {
            const idStr = note._id.toString();
            noteIds.push(idStr);

            if (note.workspaceFolderId) {
                folderIdsSet.add(note.workspaceFolderId.toString());
            }
            if (note.createdBy) {
                creatorUserIdsSet.add(note.createdBy.toString());
            }
        }

        const [folderMap, favoriteMap, creatorMap, assigneesMap, checklistsMap] = await Promise.all([
            this.stickyNoteRepository.findFolderNamesMap(Array.from(folderIdsSet)),
            this.stickyNoteRepository.findFavoritesMap(noteIds, userId),
            this.stickyNoteRepository.findCreatorEmailsMap(Array.from(creatorUserIdsSet)),
            this.stickyNoteRepository.findAssigneesMap(noteIds),
            this.stickyNoteRepository.findChecklistsMap(noteIds),
        ]);

        const mappedData = result.data.map((note) => {
            const noteIdStr = note._id.toString();
            const folderIdStr = note.workspaceFolderId ? note.workspaceFolderId.toString() : null;
            const creatorIdStr = note.createdBy ? note.createdBy.toString() : null;

            const favId = favoriteMap.get(noteIdStr);
            const checklists = checklistsMap.get(noteIdStr) ?? [];

            return mapStickyNoteListItem(note, {
                folderName: folderIdStr ? (folderMap.get(folderIdStr) ?? null) : null,
                isFavorite: Boolean(favId),
                favoriteId: favId ?? null,
                creatorEmail: creatorIdStr ? (creatorMap.get(creatorIdStr) ?? null) : null,
                assignees: assigneesMap.get(noteIdStr) ?? [],
                checklists,
            });
        });

        return {
            data: mappedData,
            pagination: result.pagination,
        };
    }

    async updateStickyNote(
        id: string,
        data: IStickyNoteUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findById(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
            updatedBy,
            stickyNote.workspaceId.toString(),
        );
        permissionAuthorizationService.assertNoteAccess(auth, stickyNote, PermissionAction.UPDATE);

        if (data.workspaceId && String(data.workspaceId) !== stickyNote.workspaceId.toString()) {
            throw new AppError(StickyNoteMessages.CANNOT_UPDATE_WORKSPACE, 400);
        }

        const nextWorkspaceId = data.workspaceId
            ? String(data.workspaceId)
            : stickyNote.workspaceId.toString();
        const nextWorkspaceFolderId = data.workspaceFolderId
            ? String(data.workspaceFolderId)
            : (stickyNote.workspaceFolderId?.toString() ?? "");
        const nextColumnId = data.columnId ? String(data.columnId) : stickyNote.columnId.toString();

        const hierarchyChanged =
            (data.workspaceId && data.workspaceId !== stickyNote.workspaceId.toString()) ||
            (data.workspaceFolderId && data.workspaceFolderId !== stickyNote.workspaceFolderId?.toString()) ||
            (data.columnId && data.columnId !== stickyNote.columnId.toString());

        if (hierarchyChanged) {
            await this.assertStickyNoteHierarchy(nextWorkspaceId, nextWorkspaceFolderId, nextColumnId);
        }

        const updateData: Partial<IStickyNote> = {
            updatedBy: new Types.ObjectId(updatedBy),
        };
        const changes: Array<{
            field: string;
            oldValue?: unknown;
            newValue?: unknown;
        }> = [];

        if (data.title !== undefined) {
            const normalizedTitle = StickyNoteValidation.normalizeTitle(data.title);
            if (normalizedTitle !== stickyNote.title) {
                updateData.title = normalizedTitle;
                changes.push({
                    field: "title",
                    oldValue: stickyNote.title,
                    newValue: normalizedTitle,
                });
            }
        }
        if (data.content !== undefined) {
            const normalizedContent = StickyNoteValidation.normalizeContent(data.content);
            if (normalizedContent !== stickyNote.content) {
                updateData.content = normalizedContent;
                changes.push({
                    field: "content",
                    oldValue: stickyNote.content,
                    newValue: normalizedContent,
                });
            }
        }
        if (data.color !== undefined && data.color !== stickyNote.color) {
            updateData.color = data.color;
            changes.push({
                field: "color",
                oldValue: stickyNote.color,
                newValue: data.color,
            });
        }
        if (data.priority !== undefined && data.priority !== stickyNote.priority) {
            updateData.priority = data.priority;
            changes.push({
                field: "priority",
                oldValue: stickyNote.priority,
                newValue: data.priority,
            });
        }
        if (data.shape !== undefined && data.shape !== stickyNote.shape) {
            updateData.shape = data.shape;
            changes.push({
                field: "shape",
                oldValue: stickyNote.shape,
                newValue: data.shape,
            });
        }
        if (data.variant !== undefined && data.variant !== stickyNote.variant) {
            updateData.variant = data.variant;
            changes.push({
                field: "variant",
                oldValue: stickyNote.variant,
                newValue: data.variant,
            });
        }
        if (data.backgroundPattern !== undefined && data.backgroundPattern !== stickyNote.backgroundPattern) {
            updateData.backgroundPattern = data.backgroundPattern;
            changes.push({
                field: "backgroundPattern",
                oldValue: stickyNote.backgroundPattern,
                newValue: data.backgroundPattern,
            });
        }
        if (data.position !== undefined && data.position !== stickyNote.position) {
            updateData.position = data.position;
            changes.push({
                field: "position",
                oldValue: stickyNote.position,
                newValue: data.position,
            });
        }
        if (data.columnId && data.columnId !== stickyNote.columnId.toString()) {
            updateData.columnId = new Types.ObjectId(data.columnId);
            changes.push({
                field: "columnId",
                oldValue: stickyNote.columnId.toString(),
                newValue: data.columnId,
            });
        }
        if (data.workspaceFolderId && data.workspaceFolderId !== stickyNote.workspaceFolderId?.toString()) {
            updateData.workspaceFolderId = new Types.ObjectId(data.workspaceFolderId);
            changes.push({
                field: "workspaceFolderId",
                oldValue: stickyNote.workspaceFolderId?.toString() ?? null,
                newValue: data.workspaceFolderId,
            });
        }
        if (data.noteDate !== undefined) {
            const normalizedDate = this.stickyNoteDateService.normalizeNullableDateKey(data.noteDate);
            if (normalizedDate !== stickyNote.noteDate) {
                updateData.noteDate = normalizedDate;
                changes.push({
                    field: "noteDate",
                    oldValue: stickyNote.noteDate,
                    newValue: normalizedDate,
                });
            }
        }

        const updatedNote = await this.stickyNoteRepository.updateById(id, updateData);
        if (!updatedNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }

        if (changes.length > 0) {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE,
                    resourceId: updatedNote._id.toString(),
                    resourceName: updatedNote.title || "Sticky Note",
                },
                `Sticky note ${updatedNote.title || updatedNote._id.toString()} was updated successfully.`,
                changes,
            );
        }

        if (data.assigneeIds !== undefined) {
            await this.stickyNoteAssigneeService.syncStickyNoteAssignees(
                id,
                { assigneeIds: data.assigneeIds },
                updatedBy,
                context,
            );
        }

        return this.resolveNoteDetailResponse(updatedNote, updatedBy);
    }

    async updateStickyNoteStatus(
        id: string,
        status: StickyNoteStatus,
        updatedBy?: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findByIdRaw(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }

        if (updatedBy) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                updatedBy,
                stickyNote.workspaceId.toString(),
            );
            permissionAuthorizationService.assertNoteAccess(auth, stickyNote, PermissionAction.UPDATE);
        }

        if (stickyNote.status === StickyNoteStatus.TRASHED && status !== StickyNoteStatus.TRASHED) {
            if (status !== StickyNoteStatus.ACTIVE) {
                throw new AppError(StickyNoteMessages.CANNOT_RESTORE_DEFAULT, 400);
            }
            await this.assertCanRestore(stickyNote);
        }

        const oldStatus = stickyNote.status;
        let reservation: any = null;
        if (status === StickyNoteStatus.ACTIVE && oldStatus !== StickyNoteStatus.ACTIVE) {
            reservation = await this.subscriptionEntitlementService.assertCanActivateStickyNote(
                updatedBy ?? stickyNote.createdBy.toString(),
                id,
            );
        }

        try {
            const userObjId = updatedBy ? new Types.ObjectId(updatedBy) : undefined;
            const updatedNote = await this.stickyNoteRepository.updateStatus(id, status, userObjId);

            if (!updatedNote) {
                throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
            }

            await this.auditLogService.logStatusChange(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE,
                    resourceId: stickyNote._id.toString(),
                    resourceName: stickyNote.title || "Sticky Note",
                },
                "status",
                oldStatus,
                status,
                `Sticky note ${stickyNote.title || stickyNote._id.toString()} status changed from ${oldStatus} to ${status}.`,
            );

            if (reservation) {
                await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            }

            return this.resolveNoteDetailResponse(updatedNote, updatedBy);
        } catch (error) {
            if (reservation) {
                await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            }
            throw error;
        }
    }

    async reorderStickyNote(
        id: string,
        data: IStickyNoteReorder,
        userId: string,
        context?: IAuditLogContext,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        if (data.beforeId && String(data.beforeId) === id) {
            throw new AppError(StickyNoteMessages.CANNOT_REORDER_SELF, 400);
        }
        if (data.afterId && String(data.afterId) === id) {
            throw new AppError(StickyNoteMessages.CANNOT_REORDER_SELF, 400);
        }
        if (data.beforeId && data.afterId && String(data.beforeId) === String(data.afterId)) {
            throw new AppError(StickyNoteMessages.IDENTICAL_NEIGHBORS, 400);
        }

        const movedNote = await this.stickyNoteRepository.findById(id);
        if (!movedNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }

        const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
            userId,
            movedNote.workspaceId.toString(),
        );
        permissionAuthorizationService.assertNoteAccess(auth, movedNote, [
            PermissionAction.UPDATE,
            PermissionAction.MOVE,
        ]);

        const targetColumnId = data.columnId ? String(data.columnId).trim() : movedNote.columnId.toString();
        if (!Types.ObjectId.isValid(targetColumnId)) {
            throw new AppError(StickyNoteMessages.INVALID_COLUMN_ID, 400);
        }

        const targetColumn = await this.stickyNoteRepository.findColumnById(targetColumnId);
        if (!targetColumn) {
            throw new AppError(StickyNoteMessages.COLUMN_NOT_FOUND, 404);
        }
        if (targetColumn.workspaceId.toString() !== movedNote.workspaceId.toString()) {
            throw new AppError(StickyNoteMessages.COLUMN_WORKSPACE_MISMATCH, 400);
        }

        const [beforeNote, afterNote] = await Promise.all([
            data.beforeId ? this.stickyNoteRepository.findById(data.beforeId) : null,
            data.afterId ? this.stickyNoteRepository.findById(data.afterId) : null,
        ]);

        if (data.beforeId && !beforeNote) {
            throw new AppError(StickyNoteMessages.BEFORE_NOTE_NOT_FOUND, 404);
        }
        if (beforeNote && beforeNote.columnId.toString() !== targetColumnId) {
            throw new AppError(StickyNoteMessages.NEIGHBOR_COLUMN_MISMATCH, 400);
        }
        if (data.afterId && !afterNote) {
            throw new AppError(StickyNoteMessages.AFTER_NOTE_NOT_FOUND, 404);
        }
        if (afterNote && afterNote.columnId.toString() !== targetColumnId) {
            throw new AppError(StickyNoteMessages.NEIGHBOR_COLUMN_MISMATCH, 400);
        }

        let beforeRank = beforeNote?.rank;
        let afterRank = afterNote?.rank;

        if (beforeNote && afterNote) {
            if (!beforeRank || !afterRank || beforeRank >= afterRank) {
                await this.stickyNoteRepository.normalizeRanks(targetColumnId);
                const [refetchedBefore, refetchedAfter] = await Promise.all([
                    this.stickyNoteRepository.findById(data.beforeId!),
                    this.stickyNoteRepository.findById(data.afterId!),
                ]);
                beforeRank = refetchedBefore?.rank;
                afterRank = refetchedAfter?.rank;
            }
        } else if (beforeNote && !afterNote) {
            afterRank =
                (await this.stickyNoteRepository.findAdjacentRank(targetColumnId, beforeNote.rank, "after", [
                    id,
                    data.beforeId!,
                ])) ?? undefined;
        } else if (!beforeNote && afterNote) {
            beforeRank =
                (await this.stickyNoteRepository.findAdjacentRank(targetColumnId, afterNote.rank, "before", [
                    id,
                    data.afterId!,
                ])) ?? undefined;
        }

        const isColumnChanged = movedNote.columnId.toString() !== targetColumnId;
        let newRank: string | null = null;

        if (!beforeNote && !afterNote) {
            const highestRank = await this.stickyNoteRepository.getHighestRankByColumn(targetColumnId, id);
            if (!highestRank) {
                newRank = RankUtil.generateInitialRank();
            } else if (!isColumnChanged && movedNote.rank && movedNote.rank > highestRank) {
                newRank = movedNote.rank;
            } else {
                newRank = RankUtil.generateRankAfter(highestRank);
            }
        } else {
            newRank = RankUtil.generateRankBetween(beforeRank, afterRank);
        }

        if (!newRank || RankUtil.isRankSpaceExhausted(newRank)) {
            await this.stickyNoteRepository.normalizeRanks(targetColumnId);
            if (!data.beforeId && !data.afterId) {
                const highest = await this.stickyNoteRepository.getHighestRankByColumn(targetColumnId, id);
                newRank = highest ? RankUtil.generateRankAfter(highest) : RankUtil.generateInitialRank();
            } else {
                const [refetchedBefore, refetchedAfter] = await Promise.all([
                    data.beforeId ? this.stickyNoteRepository.findById(data.beforeId) : null,
                    data.afterId ? this.stickyNoteRepository.findById(data.afterId) : null,
                ]);
                newRank =
                    RankUtil.generateRankBetween(refetchedBefore?.rank, refetchedAfter?.rank) ??
                    RankUtil.generateInitialRank();
            }
        }

        if (!newRank) throw new AppError("Unable to reorder this sticky note. Please try again.", 409);

        const targetFolderId = targetColumn.workspaceFolderId
            ? targetColumn.workspaceFolderId.toString()
            : null;
        const userObjectId = new Types.ObjectId(userId);
        const updatedNote = isColumnChanged
            ? await this.stickyNoteRepository.moveToColumnAndRank(
                  id,
                  targetColumnId,
                  newRank,
                  targetFolderId,
                  userObjectId,
              )
            : await this.stickyNoteRepository.updateRank(id, newRank, userObjectId);

        if (!updatedNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }

        await this.stickyNoteRepository.syncColumnPositions(targetColumnId);
        if (isColumnChanged) {
            await this.stickyNoteRepository.syncColumnPositions(movedNote.columnId.toString());
        }

        const freshNote = await this.stickyNoteRepository.findById(id);

        await this.auditLogService.logUpdate(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE,
                resourceId: id,
                resourceName: updatedNote.title || "Sticky Note",
            },
            `Sticky note "${updatedNote.title || id}" was reordered successfully.`,
            [
                { field: "rank", oldValue: movedNote.rank, newValue: newRank },
                ...(isColumnChanged
                    ? [
                          {
                              field: "columnId",
                              oldValue: movedNote.columnId.toString(),
                              newValue: targetColumnId,
                          },
                      ]
                    : []),
            ],
        );

        return this.resolveNoteDetailResponse(freshNote ?? updatedNote, userId);
    }

    async deleteStickyNote(id: string, updatedBy?: string, context?: IAuditLogContext) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findById(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        if (updatedBy) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                updatedBy,
                stickyNote.workspaceId.toString(),
            );
            permissionAuthorizationService.assertNoteAccess(auth, stickyNote, [
                PermissionAction.DELETE,
                PermissionAction.ARCHIVE,
            ]);
        }
        if (stickyNote.status === StickyNoteStatus.TRASHED) {
            throw new AppError(StickyNoteMessages.ALREADY_TRASHED, 400);
        }

        const userObjId = updatedBy ? new Types.ObjectId(updatedBy) : undefined;
        const deletedNote = await this.stickyNoteRepository.softDelete(id, userObjId);
        if (!deletedNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE,
                resourceId: stickyNote._id.toString(),
                resourceName: stickyNote.title || "Sticky Note",
            },
            `Sticky note ${stickyNote.title || stickyNote._id.toString()} was moved to trash and will be retained for ${STICKY_NOTE_CONSTANTS.TRASH.RETENTION_DAYS} days.`,
        );

        return this.resolveNoteDetailResponse(deletedNote, updatedBy);
    }

    async restoreStickyNote(id: string, updatedBy?: string, context?: IAuditLogContext) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findByIdRaw(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        if (updatedBy) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                updatedBy,
                stickyNote.workspaceId.toString(),
            );
            permissionAuthorizationService.assertNoteAccess(auth, stickyNote, [
                PermissionAction.UPDATE,
                PermissionAction.DELETE,
            ]);
        }

        await this.assertCanRestore(stickyNote);
        const reservation = await this.subscriptionEntitlementService.assertCanActivateStickyNote(
            updatedBy ?? stickyNote.createdBy.toString(),
            id,
        );

        try {
            const userObjId = updatedBy ? new Types.ObjectId(updatedBy) : undefined;
            const restoredNote = await this.stickyNoteRepository.restore(id, userObjId);
            if (!restoredNote) {
                throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
            }

            await this.auditLogService.log({
                ...context,
                action: AuditLogAction.RESTORE,
                module: AppModule.STICKY_NOTE,
                resourceId: new Types.ObjectId(id),
                resourceName: stickyNote.title || "Sticky Note",
                description: `Sticky note ${stickyNote.title || stickyNote._id.toString()} was restored successfully.`,
            });

            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return this.resolveNoteDetailResponse(restoredNote, updatedBy);
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
    }

    async permanentlyDeleteStickyNote(id: string, deletedBy?: string, context?: IAuditLogContext) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        const stickyNote = await this.stickyNoteRepository.findByIdRaw(id);
        if (!stickyNote) {
            throw new AppError(StickyNoteMessages.NOT_FOUND, 404, "STICKY_NOTE_NOT_FOUND");
        }
        if (deletedBy) {
            const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                deletedBy,
                stickyNote.workspaceId.toString(),
            );
            permissionAuthorizationService.assertNoteAccess(auth, stickyNote, PermissionAction.DELETE);
        }
        if (stickyNote.status !== StickyNoteStatus.TRASHED) {
            throw new AppError(StickyNoteMessages.PERMANENT_DELETE_REQUIRES_TRASH, 400);
        }

        const resourceName = stickyNote.title || "Sticky Note";
        const result = await this.stickyNotePurgeService.purgeById(id);

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE,
                resourceId: id,
                resourceName,
            },
            `Sticky note ${resourceName} was permanently deleted with its dependent sticky-note data.`,
        );

        return result;
    }

    async purgeExpiredStickyNotes(
        now = new Date(),
        batchSize = STICKY_NOTE_CONSTANTS.TRASH.PURGE_BATCH_SIZE,
    ) {
        const ids = await this.stickyNoteRepository.findExpiredTrashedIds(now, batchSize);
        const result = {
            found: ids.length,
            purged: 0,
            failed: 0,
            failedIds: [] as string[],
        };
        for (const id of ids) {
            try {
                await this.stickyNotePurgeService.purgeById(id);
                result.purged += 1;
            } catch {
                result.failed += 1;
                result.failedIds.push(id);
            }
        }
        return result;
    }

    private async resolveNoteDetailResponse(
        note: IStickyNoteRecord,
        userId?: string,
    ): Promise<IStickyNoteDetailResponse> {
        const noteId = note._id.toString();
        const folderId = note.workspaceFolderId ? note.workspaceFolderId.toString() : null;

        const [folderName, fav, assignees, checklists] = await Promise.all([
            folderId ? this.stickyNoteRepository.findSingleFolderName(folderId) : Promise.resolve(null),
            userId
                ? this.stickyNoteRepository.findSingleFavorite(noteId, userId)
                : Promise.resolve({ isFavorite: false, favoriteId: null }),
            this.stickyNoteRepository.findSingleAssignees(noteId),
            this.stickyNoteRepository.findSingleChecklists(noteId),
        ]);

        return mapStickyNoteDetail(note, {
            folderName,
            isFavorite: fav.isFavorite,
            favoriteId: fav.favoriteId,
            assignees,
            checklists,
        });
    }

    private async assertCanRestore(stickyNote: IStickyNoteRecord): Promise<void> {
        if (stickyNote.status !== StickyNoteStatus.TRASHED) {
            throw new AppError("Only trashed sticky notes can be restored.", 400);
        }
        if (stickyNote.purgeAfter && stickyNote.purgeAfter <= new Date()) {
            throw new AppError(StickyNoteMessages.RESTORE_WINDOW_EXPIRED, 410);
        }
        await this.assertStickyNoteHierarchy(
            stickyNote.workspaceId.toString(),
            stickyNote.workspaceFolderId?.toString() ?? "",
            stickyNote.columnId.toString(),
        );
    }

    private async assertStickyNoteHierarchy(
        workspaceId: string,
        workspaceFolderId: string,
        columnId: string,
    ): Promise<void> {
        const [workspace, folder, column] = await this.stickyNoteRepository.findHierarchy(
            workspaceId,
            workspaceFolderId,
            columnId,
        );

        if (!workspace) {
            throw new AppError(StickyNoteMessages.WORKSPACE_NOT_FOUND, 404);
        }
        if (isWorkspaceTrashed(workspace.status)) {
            throw new AppError(StickyNoteMessages.WORKSPACE_DELETED, 400);
        }
        if (!folder) {
            throw new AppError(StickyNoteMessages.WORKSPACE_FOLDER_NOT_FOUND, 404);
        }
        if (String(folder.status ?? "").toUpperCase() === "DELETED") {
            throw new AppError(StickyNoteMessages.WORKSPACE_FOLDER_DELETED, 400);
        }
        if (folder.workspaceId.toString() !== workspaceId) {
            throw new AppError(StickyNoteMessages.WORKSPACE_FOLDER_MISMATCH, 400);
        }
        if (!column) {
            throw new AppError(StickyNoteMessages.COLUMN_NOT_FOUND, 404);
        }
        if (column.workspaceId.toString() !== workspaceId) {
            throw new AppError(StickyNoteMessages.COLUMN_WORKSPACE_MISMATCH, 400);
        }
        if (column.workspaceFolderId?.toString() !== workspaceFolderId) {
            throw new AppError(StickyNoteMessages.COLUMN_FOLDER_MISMATCH, 400);
        }
    }
}
