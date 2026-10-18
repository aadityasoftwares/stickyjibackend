import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import {
    Types,
} from "mongoose";

import type {
    IStickyNoteChecklistCreate,
    IStickyNoteChecklistFilter,
    IStickyNoteChecklistResponse,
    IStickyNoteChecklistUpdate,
    StickyNoteChecklistSortField,
} from "../interfaces/stickyNoteChecklist.interface.js";

import {
    StickyNoteChecklistStatus,
} from "../constants/stickyNoteChecklist.enums.js";

import {
    STICKY_NOTE_CHECKLIST_CONSTANTS,
} from "../constants/stickyNoteChecklist.constants.js";

import {
    StickyNoteChecklistMessages,
} from "../constants/stickyNoteChecklist.messages.js";

import {
    StickyNoteChecklistRepository,
} from "../repositories/stickyNoteChecklist.repository.js";

import {
    StickyNoteChecklistValidation,
} from "../validations/stickyNoteChecklist.validation.js";

import {
    StickyNoteModel,
} from "../../stickynotes/models/stickyNote.model.js";

import {
    StickyNoteStatus,
} from "../../stickynotes/constants/stickyNote.enums.js";

import {
    AuditLogAction,
} from "../../auditlog/constants/auditLog.enums.js";

import {
    AuditLogService,
} from "../../auditlog/services/auditLog.service.js";

import type {
    IAuditLogContext,
} from "../../auditlog/interfaces/auditLog.interface.js";

import {
    AppModule,
} from "../../../utils/enums/appModule.enums.js";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

export class StickyNoteChecklistService {
    private readonly stickyNoteChecklistRepository:
        StickyNoteChecklistRepository;

    private readonly auditLogService:
        AuditLogService;

    constructor() {
        this.stickyNoteChecklistRepository =
            new StickyNoteChecklistRepository();

        this.auditLogService =
            new AuditLogService();
    }

    async createStickyNoteChecklist(
        data:
            IStickyNoteChecklistCreate,
        createdBy: string,
        context?:
            IAuditLogContext,
    ) {
        const userObjectId =
            this.getUserObjectId(
                createdBy,
            );

        const stickyNoteId =
            this.getObjectIdString(
                data.stickyNoteId,
                StickyNoteChecklistMessages.INVALID_STICKY_NOTE_ID,
            );

        const normalizedTitle =
            StickyNoteChecklistValidation
                .normalizeTitle(
                    data.title,
                );

        const positionPromise =
            data.position !==
                undefined
                ? Promise.resolve(
                    data.position,
                )
                : this
                    .stickyNoteChecklistRepository
                    .getNextPositionByStickyNote(
                        stickyNoteId,
                    );

        const [
            ,
            checklistCount,
            position,
        ] =
            await Promise.all([
                this
                    .assertStickyNoteUsable(
                        stickyNoteId,
                    ),

                this
                    .stickyNoteChecklistRepository
                    .countUsableByStickyNote(
                        stickyNoteId,
                    ),

                positionPromise,
            ]);

        if (
            checklistCount >=
            STICKY_NOTE_CHECKLIST_CONSTANTS
                .MAX_CHECKLISTS_PER_NOTE
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .MAX_CHECKLISTS_REACHED,
                409,
            );
        }

        try {
            const checklist =
                await this
                    .stickyNoteChecklistRepository
                    .create({
                        stickyNoteId:
                            new Types.ObjectId(
                                stickyNoteId,
                            ),
                        title:
                            normalizedTitle,
                        position,
                        status:
                            StickyNoteChecklistStatus.ACTIVE,
                        createdBy:
                            userObjectId,
                        updatedBy:
                            userObjectId,
                        archivedAt:
                            null,
                        deletedAt:
                            null,
                    });

            await this.auditLogService
                .logCreate(
                    context ?? {},
                    {
                        module:
                            AppModule.STICKY_NOTE_CHECKLIST,
                        resourceId:
                            checklist._id.toString(),
                        resourceName:
                            checklist.title,
                    },
                    `Sticky note checklist "${checklist.title}" was created successfully.`,
                );

            return this.toResponse(
                checklist,
            );
        } catch (error) {
            this.throwIfDuplicateTitle(
                error,
            );

            throw error;
        }
    }

    async getStickyNoteChecklistById(
        id: string,
    ) {
        const checklist =
            await this
                .stickyNoteChecklistRepository
                .findById(
                    id,
                );

        if (!checklist) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        await this.assertStickyNoteUsable(
            checklist.stickyNoteId.toString(),
        );

        return this.toResponse(
            checklist,
        );
    }

    async getStickyNoteChecklists(
        filters:
            IStickyNoteChecklistFilter = {},
    ) {
        const stickyNoteId =
            this.getObjectIdString(
                filters.stickyNoteId,
                StickyNoteChecklistMessages.INVALID_STICKY_NOTE_ID,
            );

        const normalizedFilters:
            IStickyNoteChecklistFilter =
        {
            ...filters,
            stickyNoteId,
            search:
                filters.search
                    ?.trim() ||
                undefined,
            page:
                Math.max(
                    STICKY_NOTE_CHECKLIST_CONSTANTS
                        .PAGINATION
                        .DEFAULT_PAGE,
                    filters.page ??
                    STICKY_NOTE_CHECKLIST_CONSTANTS
                        .PAGINATION
                        .DEFAULT_PAGE,
                ),
            limit:
                Math.min(
                    Math.max(
                        1,
                        filters.limit ??
                        STICKY_NOTE_CHECKLIST_CONSTANTS
                            .PAGINATION
                            .DEFAULT_LIMIT,
                    ),
                    STICKY_NOTE_CHECKLIST_CONSTANTS
                        .PAGINATION
                        .MAX_LIMIT,
                ),
            sortBy:
                filters.sortBy ??
                "position",
            sortOrder:
                filters.sortOrder ??
                "asc",
        };

        const [
            ,
            result,
        ] =
            await Promise.all([
                this.assertStickyNoteUsable(
                    stickyNoteId,
                ),

                this
                    .stickyNoteChecklistRepository
                    .findAll(
                        normalizedFilters,
                    ),
            ]);

        return {
            data:
                result.data.map(
                    checklist =>
                        this.toResponse(
                            checklist,
                        ),
                ),
            pagination:
                result.pagination,
        };
    }

    async updateStickyNoteChecklist(
        id: string,
        data:
            IStickyNoteChecklistUpdate,
        updatedBy: string,
        context?:
            IAuditLogContext,
    ) {
        const userObjectId =
            this.getUserObjectId(
                updatedBy,
            );

        const existing =
            await this
                .stickyNoteChecklistRepository
                .findById(
                    id,
                );

        if (!existing) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        await this.assertStickyNoteUsable(
            existing.stickyNoteId.toString(),
        );

        const updateData:
            IStickyNoteChecklistUpdate =
            {};

        const changes:
            Array<{
                field: string;
                oldValue?: unknown;
                newValue?: unknown;
            }> =
            [];

        if (
            data.title !==
            undefined
        ) {
            const normalizedTitle =
                StickyNoteChecklistValidation
                    .normalizeTitle(
                        data.title,
                    );

            if (
                normalizedTitle !==
                existing.title
            ) {
                updateData.title =
                    normalizedTitle;

                changes.push({
                    field:
                        "title",
                    oldValue:
                        existing.title,
                    newValue:
                        normalizedTitle,
                });
            }
        }

        if (
            data.position !==
            undefined &&
            data.position !==
            existing.position
        ) {
            updateData.position =
                data.position;

            changes.push({
                field:
                    "position",
                oldValue:
                    existing.position,
                newValue:
                    data.position,
            });
        }

        if (
            changes.length ===
            0
        ) {
            return this.toResponse(
                existing,
            );
        }

        try {
            const checklist =
                await this
                    .stickyNoteChecklistRepository
                    .updateById(
                        id,
                        {
                            ...updateData,
                            updatedBy:
                                userObjectId,
                        },
                    );

            if (!checklist) {
                throw new AppError(
                    StickyNoteChecklistMessages
                        .NOT_FOUND,
                    404,
                );
            }

            await this.auditLogService
                .logUpdate(
                    context ?? {},
                    {
                        module:
                            AppModule.STICKY_NOTE_CHECKLIST,
                        resourceId:
                            checklist._id.toString(),
                        resourceName:
                            checklist.title,
                    },
                    `Sticky note checklist "${checklist.title}" was updated successfully.`,
                    changes,
                );

            return this.toResponse(
                checklist,
            );
        } catch (error) {
            this.throwIfDuplicateTitle(
                error,
            );

            throw error;
        }
    }

    async updateStickyNoteChecklistStatus(
        id: string,
        status:
            StickyNoteChecklistStatus,
        updatedBy: string,
        context?:
            IAuditLogContext,
    ) {
        if (
            status ===
            StickyNoteChecklistStatus.DELETED
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .CANNOT_DELETE_THROUGH_STATUS,
                400,
            );
        }

        const userObjectId =
            this.getUserObjectId(
                updatedBy,
            );

        const existing =
            await this
                .stickyNoteChecklistRepository
                .findByIdIncludingDeleted(
                    id,
                );

        if (!existing) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        await this.assertStickyNoteUsable(
            existing.stickyNoteId.toString(),
        );

        if (
            existing.status ===
            StickyNoteChecklistStatus.DELETED
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .ALREADY_DELETED,
                400,
            );
        }

        if (
            existing.status ===
            status
        ) {
            const message =
                status ===
                    StickyNoteChecklistStatus.ACTIVE
                    ? StickyNoteChecklistMessages
                        .ALREADY_ACTIVE
                    : StickyNoteChecklistMessages
                        .ALREADY_ARCHIVED;

            throw new AppError(
                message,
                400,
            );
        }

        const oldStatus =
            existing.status;

        const checklist =
            await this
                .stickyNoteChecklistRepository
                .updateStatus(
                    id,
                    status,
                    userObjectId,
                );

        if (!checklist) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        await this.auditLogService.log({
            ...context,
            action:
                AuditLogAction.STATUS_CHANGE,
            module:
                AppModule.STICKY_NOTE_CHECKLIST,
            resourceId:
                checklist._id.toString(),
            resourceName:
                checklist.title,
            description:
                `Sticky note checklist "${checklist.title}" status was changed from "${oldStatus}" to "${status}".`,
            changes: [
                {
                    field:
                        "status",
                    oldValue:
                        oldStatus,
                    newValue:
                        status,
                },
            ],
        });

        return this.toResponse(
            checklist,
        );
    }

    async deleteStickyNoteChecklist(
        id: string,
        updatedBy: string,
        context?:
            IAuditLogContext,
    ) {
        const userObjectId =
            this.getUserObjectId(
                updatedBy,
            );

        const existing =
            await this
                .stickyNoteChecklistRepository
                .findByIdIncludingDeleted(
                    id,
                );

        if (!existing) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        if (
            existing.status ===
            StickyNoteChecklistStatus.DELETED
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .ALREADY_DELETED,
                400,
            );
        }

        await this.assertStickyNoteUsable(
            existing.stickyNoteId.toString(),
        );

        const checklist =
            await this
                .stickyNoteChecklistRepository
                .softDelete(
                    id,
                    userObjectId,
                );

        if (!checklist) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        await this.auditLogService.log({
            ...context,
            action:
                AuditLogAction.DELETE,
            module:
                AppModule.STICKY_NOTE_CHECKLIST,
            resourceId:
                checklist._id.toString(),
            resourceName:
                checklist.title,
            description:
                `Sticky note checklist "${checklist.title}" was deleted successfully.`,
        });

        return this.toResponse(
            checklist,
        );
    }

    async restoreStickyNoteChecklist(
        id: string,
        updatedBy: string,
        context?:
            IAuditLogContext,
    ) {
        const userObjectId =
            this.getUserObjectId(
                updatedBy,
            );

        const existing =
            await this
                .stickyNoteChecklistRepository
                .findByIdIncludingDeleted(
                    id,
                );

        if (!existing) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .NOT_FOUND,
                404,
            );
        }

        if (
            existing.status !==
            StickyNoteChecklistStatus.DELETED
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .CANNOT_RESTORE_ACTIVE,
                400,
            );
        }

        await this.assertStickyNoteUsable(
            existing.stickyNoteId.toString(),
        );

        try {
            const checklist =
                await this
                    .stickyNoteChecklistRepository
                    .restore(
                        id,
                        userObjectId,
                    );

            if (!checklist) {
                throw new AppError(
                    StickyNoteChecklistMessages
                        .NOT_FOUND,
                    404,
                );
            }

            await this.auditLogService.log({
                ...context,
                action:
                    AuditLogAction.RESTORE,
                module:
                    AppModule.STICKY_NOTE_CHECKLIST,
                resourceId:
                    checklist._id.toString(),
                resourceName:
                    checklist.title,
                description:
                    `Sticky note checklist "${checklist.title}" was restored successfully.`,
            });

            return this.toResponse(
                checklist,
            );
        } catch (error) {
            if (
                this.isDuplicateKeyError(
                    error,
                )
            ) {
                throw new AppError(
                    StickyNoteChecklistMessages
                        .RESTORE_CONFLICT,
                    409,
                );
            }

            throw error;
        }
    }

    private async assertStickyNoteUsable(
        stickyNoteId: string,
    ): Promise<void> {
        const stickyNote =
            await StickyNoteModel
                .findOne({
                    _id:
                        new Types.ObjectId(
                            stickyNoteId,
                        ),
                    status: {
                        $ne:
                            StickyNoteStatus.TRASHED,
                    },
                }).select("workspaceId").lean().exec();

        if (!stickyNote) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .STICKY_NOTE_NOT_FOUND,
                404,
            );
        }
        await workspaceAvailabilityService.assertAvailable(stickyNote.workspaceId);
    }

    private getUserObjectId(
        userId: string,
    ): Types.ObjectId {
        if (
            !Types.ObjectId.isValid(
                userId,
            )
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .INVALID_USER_ID,
                401,
            );
        }

        return new Types.ObjectId(
            userId,
        );
    }

    private getObjectIdString(
        value:
            Types.ObjectId |
            string |
            undefined,
        message: string,
    ): string {
        const id =
            value instanceof
                Types.ObjectId
                ? value.toString()
                : String(
                    value ??
                    "",
                );

        if (
            !Types.ObjectId.isValid(
                id,
            )
        ) {
            throw new AppError(
                message,
                400,
            );
        }

        return id;
    }

    private toResponse(checklist: any): IStickyNoteChecklistResponse {
        if (!checklist) return null as any;
        const id = checklist._id ? checklist._id.toString() : (checklist.id ? checklist.id.toString() : "");
        const stickyNoteId = checklist.stickyNoteId?._id
            ? checklist.stickyNoteId._id.toString()
            : (checklist.stickyNoteId ? checklist.stickyNoteId.toString() : "");
        const createdBy = checklist.createdBy?._id
            ? checklist.createdBy._id.toString()
            : (checklist.createdBy ? checklist.createdBy.toString() : null);
        const updatedBy = checklist.updatedBy?._id
            ? checklist.updatedBy._id.toString()
            : (checklist.updatedBy ? checklist.updatedBy.toString() : null);

        return {
            id,
            _id: id,
            stickyNoteId,
            title: checklist.title,
            position: checklist.position,
            status: checklist.status,
            createdBy,
            updatedBy,
            createdAt: checklist.createdAt,
            updatedAt: checklist.updatedAt,
            archivedAt: checklist.archivedAt ?? null,
            deletedAt: checklist.deletedAt ?? null,
        };
    }

    private throwIfDuplicateTitle(
        error: unknown,
    ): void {
        if (
            this.isDuplicateKeyError(
                error,
            )
        ) {
            throw new AppError(
                StickyNoteChecklistMessages
                    .ALREADY_EXISTS,
                409,
            );
        }
    }

    private isDuplicateKeyError(
        error: unknown,
    ): boolean {
        return (
            typeof error ===
            "object" &&
            error !== null &&
            "code" in error &&
            (
                error as {
                    code?: unknown;
                }
            ).code ===
            11000
        );
    }
}
