import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import { Types } from "mongoose";

import type {
    IStickyNoteFavorite,
    IStickyNoteFavoriteFilter,
    IStickyNoteFavoriteResponse,
} from "../interfaces/stickyNoteFavorite.interface.js";

import {
    StickyNoteFavoriteStatus,
} from "../constants/stickyNoteFavorite.enums.js";

import {
    StickyNoteFavoriteMessages,
} from "../constants/stickyNoteFavorite.messages.js";

import {
    StickyNoteFavoriteRepository,
} from "../repositories/stickyNoteFavorite.repository.js";

import {
    StickyNoteFavoriteValidation,
} from "../validations/stickyNoteFavorite.validation.js";

import {
    StickyNoteModel,
} from "../../stickynotes/models/stickyNote.model.js";

import {
    StickyNoteStatus,
} from "../../stickynotes/constants/stickyNote.enums.js";

import {
    WorkspaceModel,
} from "../../workspace/models/workspace.model.js";

import {
    WorkspaceMemberModel,
} from "../../workspaceMember/models/workspaceMember.model.js";

import {
    WorkspaceMemberStatus,
} from "../../workspaceMember/constants/workspaceMember.enums.js";

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

export class StickyNoteFavoriteService {
    private readonly stickyNoteFavoriteRepository:
        StickyNoteFavoriteRepository;

    private readonly auditLogService:
        AuditLogService;

    constructor() {
        this.stickyNoteFavoriteRepository =
            new StickyNoteFavoriteRepository();

        this.auditLogService =
            new AuditLogService();
    }

    async createStickyNoteFavorite(
        stickyNoteId: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(stickyNoteId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        const stickyNote = await this.assertStickyNoteAccess(
            stickyNoteId,
            userId,
        );

        const existing =
            await this.stickyNoteFavoriteRepository
                .findByStickyNoteIncludingDeleted(
                    stickyNoteId,
                    userId,
                );

        if (
            existing &&
            existing.status ===
            StickyNoteFavoriteStatus.ACTIVE
        ) {
            throw new AppError(
                StickyNoteFavoriteMessages.ALREADY_FAVORITED,
                409,
            );
        }

        if (
            existing &&
            existing.status ===
            StickyNoteFavoriteStatus.DELETED
        ) {
            const restored =
                await this
                    .stickyNoteFavoriteRepository
                    .restore(
                        existing._id.toString(),
                        userId,
                    );

            if (!restored) {
                throw new AppError(
                    StickyNoteFavoriteMessages.NOT_FOUND,
                    404,
                );
            }

            await this.auditLogService.log({
                ...context,
                action: AuditLogAction.RESTORE,
                module:
                    AppModule.STICKY_NOTE_FAVORITE,
                resourceId:
                    restored._id.toString(),
                resourceName:
                    `Sticky Note Favorite`,
                description:
                    `Sticky note "${stickyNote.title || stickyNoteId}" favorite was restored successfully.`,
            });

            return this.toResponse(restored);
        }

        const favoriteData:
            Partial<IStickyNoteFavorite> = {
            stickyNoteId:
                new Types.ObjectId(
                    stickyNoteId,
                ),

            userId:
                new Types.ObjectId(userId),

            status:
                StickyNoteFavoriteStatus.ACTIVE,

            deletedAt: null,
        };

        const created =
            await this
                .stickyNoteFavoriteRepository
                .create(favoriteData);

        const favorite =
            await this
                .stickyNoteFavoriteRepository
                .findById(
                    created._id.toString(),
                    userId,
                );

        await this.auditLogService.logCreate(
            context ?? {},
            {
                module:
                    AppModule.STICKY_NOTE_FAVORITE,

                resourceId:
                    created._id.toString(),

                resourceName:
                    `Sticky Note Favorite`,
            },

            `Sticky note "${stickyNote.title || stickyNoteId}" was added to favorites successfully.`,
        );

        return this.toResponse(favorite ?? created);
    }

    async getStickyNoteFavoriteById(
        id: string,
        userId: string,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        let favorite =
            await this
                .stickyNoteFavoriteRepository
                .findById(
                    id,
                    userId,
                );

        if (!favorite) {
            favorite =
                await this
                    .stickyNoteFavoriteRepository
                    .findByStickyNote(
                        id,
                        userId,
                    );
        }

        if (!favorite) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }

        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(favorite.stickyNoteId);
        return this.toResponse(favorite);
    }

    async checkStickyNoteFavorite(
        stickyNoteId: string,
        userId: string,
    ): Promise<{ isFavorite: boolean; favorite: IStickyNoteFavoriteResponse | null }> {
        if (!Types.ObjectId.isValid(stickyNoteId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(stickyNoteId);
        const favorite =
            await this
                .stickyNoteFavoriteRepository
                .findByStickyNote(
                    stickyNoteId,
                    userId,
                );

        return {
            isFavorite: Boolean(favorite),
            favorite: favorite ? this.toResponse(favorite) : null,
        };
    }

    async getStickyNoteFavorites(
        userId: string,
        filters: IStickyNoteFavoriteFilter = {},
    ) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        if (
            filters.sortBy &&
            !StickyNoteFavoriteValidation.isValidSortField(
                filters.sortBy,
            )
        ) {
            throw new AppError("Invalid sort field.", 400);
        }

        if (
            filters.sortOrder &&
            !StickyNoteFavoriteValidation.isValidSortOrder(
                filters.sortOrder,
            )
        ) {
            throw new AppError('sortOrder must be "asc" or "desc".', 400);
        }

        const page =
            filters.page && filters.page > 0
                ? Number(filters.page)
                : 1;

        const limit =
            filters.limit && filters.limit > 0
                ? Math.min(Number(filters.limit), 100)
                : 10;

        const result =
            await this
                .stickyNoteFavoriteRepository
                .findAll({
                    ...filters,
                    userId,
                    page,
                    limit,
                });

        return {
            data: result.data.map(item => this.toResponse(item)),
            pagination: result.pagination,
        };
    }

    async updateStickyNoteFavoriteStatus(
        id: string,
        status: StickyNoteFavoriteStatus,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        let existing =
            await this
                .stickyNoteFavoriteRepository
                .findByIdIncludingDeleted(
                    id,
                    userId,
                );

        if (!existing) {
            existing =
                await this
                    .stickyNoteFavoriteRepository
                    .findByStickyNoteIncludingDeleted(
                        id,
                        userId,
                    );
        }

        if (!existing) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);

        if (
            existing.status === status
        ) {
            if (
                status ===
                StickyNoteFavoriteStatus.ACTIVE
            ) {
                throw new AppError(
                    StickyNoteFavoriteMessages.ALREADY_FAVORITED,
                    400,
                );
            }

            if (
                status ===
                StickyNoteFavoriteStatus.DELETED
            ) {
                throw new AppError(
                    StickyNoteFavoriteMessages.ALREADY_DELETED,
                    400,
                );
            }
        }

        const oldStatus =
            existing.status;

        const favorite =
            await this
                .stickyNoteFavoriteRepository
                .updateStatus(
                    existing._id.toString(),
                    userId,
                    status,
                );

        if (!favorite) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }

        await this.auditLogService.logStatusChange(
            context ?? {},
            {
                module:
                    AppModule.STICKY_NOTE_FAVORITE,

                resourceId:
                    favorite._id.toString(),

                resourceName:
                    `Sticky Note Favorite`,
            },

            "status",
            oldStatus,
            status,
            `Sticky note favorite status was changed from "${oldStatus}" to "${status}".`,
        );

        return this.toResponse(favorite);
    }

    async deleteStickyNoteFavorite(
        id: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        let existing =
            await this
                .stickyNoteFavoriteRepository
                .findById(
                    id,
                    userId,
                );

        if (!existing) {
            existing =
                await this
                    .stickyNoteFavoriteRepository
                    .findByStickyNote(
                        id,
                        userId,
                    );
        }

        if (!existing) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);

        const favorite =
            await this
                .stickyNoteFavoriteRepository
                .softDelete(
                    existing._id.toString(),
                    userId,
                );

        if (!favorite) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module:
                    AppModule.STICKY_NOTE_FAVORITE,

                resourceId:
                    favorite._id.toString(),

                resourceName:
                    `Sticky Note Favorite`,
            },

            `Sticky note was removed from favorites successfully.`,
        );

        return this.toResponse(favorite);
    }

    async restoreStickyNoteFavorite(
        id: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(
                StickyNoteFavoriteMessages.INVALID_ID,
                400,
            );
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(
                StickyNoteFavoriteMessages.USER_ID_REQUIRED,
                400,
            );
        }

        let existing =
            await this
                .stickyNoteFavoriteRepository
                .findByIdIncludingDeleted(
                    id,
                    userId,
                );

        if (!existing) {
            existing =
                await this
                    .stickyNoteFavoriteRepository
                    .findByStickyNoteIncludingDeleted(
                        id,
                        userId,
                    );
        }

        if (!existing) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);

        if (
            existing.status !==
            StickyNoteFavoriteStatus.DELETED
        ) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FAVORITED,
                400,
            );
        }

        const stickyNoteId =
            (existing.stickyNoteId as any)?._id?.toString() ??
            existing.stickyNoteId?.toString();

        await this.assertStickyNoteAccess(
            stickyNoteId,
            userId,
        );

        const favorite =
            await this
                .stickyNoteFavoriteRepository
                .restore(
                    existing._id.toString(),
                    userId,
                );

        if (!favorite) {
            throw new AppError(
                StickyNoteFavoriteMessages.NOT_FOUND,
                404,
            );
        }

        await this.auditLogService.log({
            ...context,

            action:
                AuditLogAction.RESTORE,

            module:
                AppModule.STICKY_NOTE_FAVORITE,

            resourceId:
                favorite._id.toString(),

            resourceName:
                `Sticky Note Favorite`,

            description:
                `Sticky note favorite was restored successfully.`,
        });

        return this.toResponse(favorite);
    }

    private async assertStickyNoteAccess(
        stickyNoteId: string,
        userId: string,
    ) {
        const stickyNote = await StickyNoteModel.findOne({
            _id: new Types.ObjectId(stickyNoteId),
            status: { $ne: StickyNoteStatus.TRASHED },
        }).select("_id workspaceId title status").lean();

        if (!stickyNote) {
            throw new AppError(
                StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND,
                404,
            );
        }

        const userObjectId = new Types.ObjectId(userId);
        const workspace = await WorkspaceModel.findById(
            stickyNote.workspaceId,
        ).select("_id ownerId createdBy status").lean();

        if (
            !workspace ||
            isWorkspaceTrashed(workspace.status)
        ) {
            throw new AppError(
                StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND,
                404,
            );
        }

        const isOwnerOrCreator =
            workspace.ownerId?.toString() === userId ||
            workspace.createdBy?.toString() === userId;

        if (!isOwnerOrCreator) {
            const isMember = await WorkspaceMemberModel.exists({
                workspaceId: stickyNote.workspaceId,
                userId: userObjectId,
                status: WorkspaceMemberStatus.ACTIVE,
            });

            if (!isMember) {
                throw new AppError(
                    StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND,
                    404,
                );
            }
        }

        return stickyNote;
    }

    private toResponse(favorite: any): IStickyNoteFavoriteResponse {
        if (!favorite) return null as any;

        const id = favorite._id ? favorite._id.toString() : favorite.id;

        return {
            id,
            _id: id,
            stickyNoteId: favorite.stickyNoteId,
            userId: favorite.userId,
            status: favorite.status,
            deletedAt: favorite.deletedAt ?? null,
            createdAt: favorite.createdAt,
            updatedAt: favorite.updatedAt,
        };
    }
}