import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { Types } from "mongoose";

import type {
    IStickyNoteChecklistItemCreate,
    IStickyNoteChecklistItemFilter,
    IStickyNoteChecklistItemResponse,
    IStickyNoteChecklistItemUpdate,
} from "../interfaces/stickyNoteChecklistItem.interface.js";

import { StickyNoteChecklistItemStatus } from "../constants/stickyNoteChecklistItem.enums.js";

import { STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS } from "../constants/stickyNoteChecklistItem.constants.js";

import { StickyNoteChecklistItemMessages } from "../constants/stickyNoteChecklistItem.messages.js";

import { StickyNoteChecklistItemRepository } from "../repositories/stickyNoteChecklistItem.repository.js";

import { StickyNoteChecklistRepository } from "../../stickyNoteschecklist/repositories/stickyNoteChecklist.repository.js";

import { StickyNoteChecklistStatus } from "../../stickyNoteschecklist/constants/stickyNoteChecklist.enums.js";

import { StickyNoteChecklistItemValidation } from "../validations/stickyNoteChecklistItem.validation.js";

import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";

import { AuditLogService } from "../../auditlog/services/auditLog.service.js";

import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

import { AppError } from "../../../utils/errors/app.error.js";

import { AuditLogConfig } from "../../../config/auditlog.config.js";

export class StickyNoteChecklistItemService {
    private readonly stickyNoteChecklistItemRepository: StickyNoteChecklistItemRepository;

    private readonly stickyNoteChecklistRepository: StickyNoteChecklistRepository;

    private readonly auditLogService: AuditLogService;

    constructor() {
        this.stickyNoteChecklistItemRepository = new StickyNoteChecklistItemRepository();

        this.stickyNoteChecklistRepository = new StickyNoteChecklistRepository();

        this.auditLogService = new AuditLogService();
    }

    async createStickyNoteChecklistItem(
        data: IStickyNoteChecklistItemCreate,
        createdBy: string,
        context?: IAuditLogContext,
    ) {
        const userObjectId = this.getUserObjectId(createdBy);

        const checklistId = this.getObjectIdString(
            data.checklistId,
            StickyNoteChecklistItemMessages.INVALID_CHECKLIST_ID,
        );

        const normalizedTitle = StickyNoteChecklistItemValidation.normalizeTitle(data.title);

        const positionPromise =
            data.position !== undefined
                ? Promise.resolve(data.position)
                : this.stickyNoteChecklistItemRepository.getNextPositionByChecklist(checklistId);

        const [, itemCount, position] = await Promise.all([
            this.assertChecklistUsable(checklistId),

            this.stickyNoteChecklistItemRepository.countUsableByChecklist(checklistId),

            positionPromise,
        ]);

        if (itemCount >= STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.MAX_ITEMS_PER_CHECKLIST) {
            throw new AppError(StickyNoteChecklistItemMessages.MAX_ITEMS_REACHED, 409);
        }

        try {
            const item = await this.stickyNoteChecklistItemRepository.create({
                checklistId: new Types.ObjectId(checklistId),
                title: normalizedTitle,
                position,
                isCompleted: false,
                status: StickyNoteChecklistItemStatus.ACTIVE,
                createdBy: userObjectId,
                updatedBy: userObjectId,
                completedBy: null,
                completedAt: null,
                archivedAt: null,
                deletedAt: null,
            });

            await this.auditLogService.logCreate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
                    resourceId: item._id.toString(),
                    resourceName: item.title,
                },
                `Sticky note checklist item "${item.title}" was created successfully.`,
            );

            return this.toResponse(item);
        } catch (error) {
            this.throwIfDuplicateTitle(error);

            throw error;
        }
    }

    async getStickyNoteChecklistItemById(id: string) {
        const item = await this.stickyNoteChecklistItemRepository.findById(id);

        if (!item) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.assertChecklistUsable(item.checklistId.toString());

        return this.toResponse(item);
    }

    async getStickyNoteChecklistItems(filters: IStickyNoteChecklistItemFilter = {}) {
        const checklistId = this.getObjectIdString(
            filters.checklistId,
            StickyNoteChecklistItemMessages.INVALID_CHECKLIST_ID,
        );

        const normalizedFilters: IStickyNoteChecklistItemFilter = {
            ...filters,
            checklistId,
            search: filters.search?.trim() || undefined,
            page: Math.max(1, filters.page ?? STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.PAGINATION.DEFAULT_PAGE),
            limit: Math.min(
                Math.max(1, filters.limit ?? STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.PAGINATION.DEFAULT_LIMIT),
                STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS.PAGINATION.MAX_LIMIT,
            ),
            sortBy: filters.sortBy ?? "position",
            sortOrder: filters.sortOrder ?? "asc",
        };

        const [, result] = await Promise.all([
            this.assertChecklistUsable(checklistId),

            this.stickyNoteChecklistItemRepository.findAll(normalizedFilters),
        ]);

        return {
            data: result.data.map((item) => this.toResponse(item)),
            pagination: result.pagination,
        };
    }

    async updateStickyNoteChecklistItem(
        id: string,
        data: IStickyNoteChecklistItemUpdate,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        const userObjectId = this.getUserObjectId(updatedBy);

        const existing = await this.stickyNoteChecklistItemRepository.findById(id);

        if (!existing) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.assertChecklistUsable(existing.checklistId.toString());

        const updateData: IStickyNoteChecklistItemUpdate = {};

        const changes: Array<{
            field: string;
            oldValue?: unknown;
            newValue?: unknown;
        }> = [];

        if (data.title !== undefined) {
            const normalizedTitle = StickyNoteChecklistItemValidation.normalizeTitle(data.title);

            if (normalizedTitle !== existing.title) {
                updateData.title = normalizedTitle;

                changes.push({
                    field: "title",
                    oldValue: existing.title,
                    newValue: normalizedTitle,
                });
            }
        }

        if (data.position !== undefined && data.position !== existing.position) {
            updateData.position = data.position;

            changes.push({
                field: "position",
                oldValue: existing.position,
                newValue: data.position,
            });
        }

        if (changes.length === 0) {
            return this.toResponse(existing);
        }

        try {
            const item = await this.stickyNoteChecklistItemRepository.updateById(id, {
                ...updateData,
                updatedBy: userObjectId,
            });

            if (!item) {
                throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
            }

            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
                    resourceId: item._id.toString(),
                    resourceName: item.title,
                },
                `Sticky note checklist item "${item.title}" was updated successfully.`,
                changes,
            );

            return this.toResponse(item);
        } catch (error) {
            this.throwIfDuplicateTitle(error);

            throw error;
        }
    }

    async updateStickyNoteChecklistItemStatus(
        id: string,
        status: StickyNoteChecklistItemStatus,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        if (status === StickyNoteChecklistItemStatus.DELETED) {
            throw new AppError(StickyNoteChecklistItemMessages.CANNOT_DELETE_THROUGH_STATUS, 400);
        }

        const userObjectId = this.getUserObjectId(updatedBy);

        const existing = await this.stickyNoteChecklistItemRepository.findByIdIncludingDeleted(id);

        if (!existing) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.assertChecklistUsable(existing.checklistId.toString());

        if (existing.status === StickyNoteChecklistItemStatus.DELETED) {
            throw new AppError(StickyNoteChecklistItemMessages.ALREADY_DELETED, 400);
        }

        if (existing.status === status) {
            const message =
                status === StickyNoteChecklistItemStatus.ACTIVE
                    ? StickyNoteChecklistItemMessages.ALREADY_ACTIVE
                    : StickyNoteChecklistItemMessages.ALREADY_ARCHIVED;

            throw new AppError(message, 400);
        }

        const oldStatus = existing.status;

        const item = await this.stickyNoteChecklistItemRepository.updateStatus(id, status, userObjectId);

        if (!item) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...(context ?? {}),
            action: AuditLogAction.STATUS_CHANGE,
            module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
            resourceId: item._id.toString(),
            resourceName: item.title,
            description: `Sticky note checklist item "${item.title}" status was changed from "${oldStatus}" to "${status}".`,
            changes: [
                {
                    field: "status",
                    oldValue: oldStatus,
                    newValue: status,
                },
            ],
        });

        return this.toResponse(item);
    }

    async updateStickyNoteChecklistItemCompletion(
        id: string,
        isCompleted: boolean,
        updatedBy: string,
        context?: IAuditLogContext,
    ) {
        const action = isCompleted ? AuditLogAction.COMPLETE : AuditLogAction.UNCOMPLETE;

        this.validateAuditAction(action);

        const userObjectId = this.getUserObjectId(updatedBy);

        const existing = await this.stickyNoteChecklistItemRepository.findCompletionStateById(id);

        if (!existing) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.assertChecklistUsable(existing.checklistId.toString());

        if (existing.isCompleted === isCompleted) {
            throw new AppError(
                isCompleted
                    ? StickyNoteChecklistItemMessages.ALREADY_COMPLETED
                    : StickyNoteChecklistItemMessages.ALREADY_INCOMPLETE,
                400,
            );
        }

        const previousState = {
            isCompleted: existing.isCompleted,
            completedAt: existing.completedAt ?? null,
            completedBy: existing.completedBy ?? null,
            updatedBy: existing.updatedBy ?? null,
        };

        const item = await this.stickyNoteChecklistItemRepository.updateCompletion(
            id,
            isCompleted,
            userObjectId,
        );

        if (!item) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        try {
            await this.auditLogService.log({
                ...(context ?? {}),
                action,
                module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
                resourceId: item._id.toString(),
                resourceName: item.title,
                description: isCompleted
                    ? `Sticky note checklist item "${item.title}" was completed successfully.`
                    : `Sticky note checklist item "${item.title}" was marked as incomplete.`,
                changes: [
                    {
                        field: "isCompleted",
                        oldValue: existing.isCompleted,
                        newValue: isCompleted,
                    },
                ],
            });
        } catch (error) {
            /**
             * Preserves the existing module's all-or-nothing behavior
             * between completion state and audit logging.
             */
            await this.stickyNoteChecklistItemRepository.restoreCompletionState(id, previousState);

            throw error;
        }

        return this.toResponse(item);
    }

    async deleteStickyNoteChecklistItem(id: string, updatedBy: string, context?: IAuditLogContext) {
        const userObjectId = this.getUserObjectId(updatedBy);

        const existing = await this.stickyNoteChecklistItemRepository.findByIdIncludingDeleted(id);

        if (!existing) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        if (existing.status === StickyNoteChecklistItemStatus.DELETED) {
            throw new AppError(StickyNoteChecklistItemMessages.ALREADY_DELETED, 400);
        }

        await this.assertChecklistUsable(existing.checklistId.toString());

        const item = await this.stickyNoteChecklistItemRepository.softDelete(id, userObjectId);

        if (!item) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...(context ?? {}),
            action: AuditLogAction.DELETE,
            module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
            resourceId: item._id.toString(),
            resourceName: item.title,
            description: `Sticky note checklist item "${item.title}" was deleted successfully.`,
        });

        return this.toResponse(item);
    }

    async restoreStickyNoteChecklistItem(id: string, updatedBy: string, context?: IAuditLogContext) {
        const userObjectId = this.getUserObjectId(updatedBy);

        const existing = await this.stickyNoteChecklistItemRepository.findByIdIncludingDeleted(id);

        if (!existing) {
            throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
        }

        if (existing.status !== StickyNoteChecklistItemStatus.DELETED) {
            throw new AppError(StickyNoteChecklistItemMessages.CANNOT_RESTORE_ACTIVE, 400);
        }

        await this.assertChecklistUsable(existing.checklistId.toString());

        try {
            const item = await this.stickyNoteChecklistItemRepository.restore(id, userObjectId);

            if (!item) {
                throw new AppError(StickyNoteChecklistItemMessages.NOT_FOUND, 404);
            }

            await this.auditLogService.log({
                ...(context ?? {}),
                action: AuditLogAction.RESTORE,
                module: AppModule.STICKY_NOTE_CHECKLIST_ITEM,
                resourceId: item._id.toString(),
                resourceName: item.title,
                description: `Sticky note checklist item "${item.title}" was restored successfully.`,
            });

            return this.toResponse(item);
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(StickyNoteChecklistItemMessages.RESTORE_CONFLICT, 409);
            }

            throw error;
        }
    }

    private async assertChecklistUsable(checklistId: string): Promise<void> {
        const checklist = await this.stickyNoteChecklistRepository.findByIdIncludingDeleted(checklistId);

        if (!checklist) {
            throw new AppError(StickyNoteChecklistItemMessages.CHECKLIST_NOT_FOUND, 404);
        }

        if (checklist.status === StickyNoteChecklistStatus.DELETED) {
            throw new AppError(StickyNoteChecklistItemMessages.CHECKLIST_DELETED, 409);
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(checklist.stickyNoteId.toString());
    }

    private getUserObjectId(userId: string): Types.ObjectId {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteChecklistItemMessages.INVALID_USER_ID, 401);
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

    private toResponse(item: any): IStickyNoteChecklistItemResponse {
        if (!item) return null as any;
        const id = item._id ? item._id.toString() : item.id ? item.id.toString() : "";
        const checklistId = item.checklistId?._id
            ? item.checklistId._id.toString()
            : item.checklistId
              ? item.checklistId.toString()
              : "";
        const createdBy = item.createdBy?._id
            ? item.createdBy._id.toString()
            : item.createdBy
              ? item.createdBy.toString()
              : null;
        const updatedBy = item.updatedBy?._id
            ? item.updatedBy._id.toString()
            : item.updatedBy
              ? item.updatedBy.toString()
              : null;
        const completedBy = item.completedBy?._id
            ? item.completedBy._id.toString()
            : item.completedBy
              ? item.completedBy.toString()
              : null;

        return {
            id,
            _id: id,
            checklistId,
            title: item.title,
            position: item.position,
            isCompleted: item.isCompleted,
            status: item.status,
            createdBy,
            updatedBy,
            completedBy,
            completedAt: item.completedAt ?? null,
            archivedAt: item.archivedAt ?? null,
            deletedAt: item.deletedAt ?? null,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        };
    }

    private validateAuditAction(action: AuditLogAction): void {
        const moduleConfig = AuditLogConfig[AppModule.STICKY_NOTE_CHECKLIST_ITEM];

        if (!moduleConfig || !moduleConfig.actions.includes(action)) {
            throw new AppError(
                `Action ${action} is not allowed for module ${AppModule.STICKY_NOTE_CHECKLIST_ITEM}.`,
                400,
            );
        }
    }

    private throwIfDuplicateTitle(error: unknown): void {
        if (this.isDuplicateKeyError(error)) {
            throw new AppError(StickyNoteChecklistItemMessages.ALREADY_EXISTS, 409);
        }
    }

    private isDuplicateKeyError(error: unknown): boolean {
        return (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (
                error as {
                    code?: unknown;
                }
            ).code === 11000
        );
    }
}
