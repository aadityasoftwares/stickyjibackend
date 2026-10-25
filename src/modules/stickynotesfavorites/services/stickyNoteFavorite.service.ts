import { subscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { isWorkspaceTrashed } from "../../workspace/constants/workspace.enums.js";
import { Types } from "mongoose";

import type {
    IStickyNoteFavorite,
    IStickyNoteFavoriteFilter,
    IStickyNoteFavoriteResponse,
} from "../interfaces/stickyNoteFavorite.interface.js";

import { StickyNoteFavoriteStatus } from "../constants/stickyNoteFavorite.enums.js";
import { StickyNoteFavoriteMessages } from "../constants/stickyNoteFavorite.messages.js";
import { StickyNoteFavoriteRepository } from "../repositories/stickyNoteFavorite.repository.js";
import { StickyNoteFavoriteValidation } from "../validations/stickyNoteFavorite.validation.js";

import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { StickyNoteRepository } from "../../stickynotes/repositories/stickynote.repository.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { mapStickyNoteListItem } from "../../stickynotes/utils/stickyNote.mapper.js";
import type {
    IStickyNoteRecord,
    IStickyNoteAssigneeNormalized,
    IStickyNoteListItemResponse,
} from "../../stickynotes/interfaces/stickynote.interface.js";

import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";

import { UserModel } from "../../user/models/user.model.js";
import { UserProfileModel } from "../../userprofile/models/userProfile.model.js";
import { MediaModel } from "../../media/models/media.model.js";
import { MediaVisibility } from "../../media/constants/media.enums.js";
import { CloudflareR2Service } from "../../media/storage/cloudflareR2.service.js";

import { AuditLogAction } from "../../auditlog/constants/auditLog.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";

export class StickyNoteFavoriteService {
    private readonly stickyNoteFavoriteRepository: StickyNoteFavoriteRepository;
    private readonly stickyNoteRepository: StickyNoteRepository;
    private readonly auditLogService: AuditLogService;
    private readonly storageService: CloudflareR2Service;

    constructor() {
        this.stickyNoteFavoriteRepository = new StickyNoteFavoriteRepository();
        this.stickyNoteRepository = new StickyNoteRepository();
        this.auditLogService = new AuditLogService();
        this.storageService = new CloudflareR2Service();
    }

    async createStickyNoteFavorite(
        stickyNoteId: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(stickyNoteId)) {
            throw new AppError(StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        const stickyNote = await this.assertStickyNoteAccess(stickyNoteId, userId);
        await subscriptionEntitlementService.assertNoteFeature(stickyNoteId, FeatureCode.NOTES);

        const existing = await this.stickyNoteFavoriteRepository.findByStickyNoteIncludingDeleted(
            stickyNoteId,
            userId,
        );

        if (existing && existing.status === StickyNoteFavoriteStatus.ACTIVE) {
            throw new AppError(StickyNoteFavoriteMessages.ALREADY_FAVORITED, 409);
        }

        if (existing && existing.status === StickyNoteFavoriteStatus.DELETED) {
            const restored = await this.stickyNoteFavoriteRepository.restore(existing._id.toString(), userId);

            if (!restored) {
                throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
            }

            await this.auditLogService.log({
                ...context,
                action: AuditLogAction.RESTORE,
                module: AppModule.STICKY_NOTE_FAVORITE,
                resourceId: restored._id.toString(),
                resourceName: `Sticky Note Favorite`,
                description: `Sticky note "${stickyNote.title || stickyNoteId}" favorite was restored successfully.`,
            });

            return this.enrichFavorite(restored, userId);
        }

        const favoriteData: Partial<IStickyNoteFavorite> = {
            stickyNoteId: new Types.ObjectId(stickyNoteId),
            userId: new Types.ObjectId(userId),
            status: StickyNoteFavoriteStatus.ACTIVE,
            deletedAt: null,
        };

        const created = await this.stickyNoteFavoriteRepository.create(favoriteData);
        const favorite = await this.stickyNoteFavoriteRepository.findById(created._id.toString(), userId);

        await this.auditLogService.logCreate(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_FAVORITE,
                resourceId: created._id.toString(),
                resourceName: `Sticky Note Favorite`,
            },
            `Sticky note "${stickyNote.title || stickyNoteId}" was added to favorites successfully.`,
        );

        return this.enrichFavorite(favorite ?? created, userId);
    }

    async getStickyNoteFavoriteById(id: string, userId: string): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteFavoriteMessages.INVALID_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        let favorite = await this.stickyNoteFavoriteRepository.findById(id, userId);

        if (!favorite) {
            favorite = await this.stickyNoteFavoriteRepository.findByStickyNote(id, userId);
        }

        if (!favorite) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }

        const stickyNoteIdStr =
            (favorite.stickyNoteId as any)?._id?.toString() ?? favorite.stickyNoteId?.toString();
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(stickyNoteIdStr);

        return this.enrichFavorite(favorite, userId);
    }

    async checkStickyNoteFavorite(
        stickyNoteId: string,
        userId: string,
    ): Promise<{ isFavorite: boolean; favorite: IStickyNoteFavoriteResponse | null }> {
        if (!Types.ObjectId.isValid(stickyNoteId)) {
            throw new AppError(StickyNoteFavoriteMessages.INVALID_STICKY_NOTE_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(stickyNoteId);
        const favorite = await this.stickyNoteFavoriteRepository.findByStickyNote(stickyNoteId, userId);

        return {
            isFavorite: Boolean(favorite),
            favorite: favorite ? await this.enrichFavorite(favorite, userId) : null,
        };
    }

    async getStickyNoteFavorites(userId: string, filters: IStickyNoteFavoriteFilter = {}) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        if (filters.sortBy && !StickyNoteFavoriteValidation.isValidSortField(filters.sortBy)) {
            throw new AppError("Invalid sort field.", 400);
        }

        if (filters.sortOrder && !StickyNoteFavoriteValidation.isValidSortOrder(filters.sortOrder)) {
            throw new AppError('sortOrder must be "asc" or "desc".', 400);
        }

        const page = filters.page && filters.page > 0 ? Number(filters.page) : 1;
        const limit = filters.limit && filters.limit > 0 ? Math.min(Number(filters.limit), 100) : 10;

        const result = await this.stickyNoteFavoriteRepository.findAll({
            ...filters,
            userId,
            page,
            limit,
        });

        const enrichedData = await this.enrichFavorites(result.data, userId);

        return {
            data: enrichedData,
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
            throw new AppError(StickyNoteFavoriteMessages.INVALID_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        let existing = await this.stickyNoteFavoriteRepository.findByIdIncludingDeleted(id, userId);

        if (!existing) {
            existing = await this.stickyNoteFavoriteRepository.findByStickyNoteIncludingDeleted(id, userId);
        }

        if (!existing) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);
        if (status === StickyNoteFavoriteStatus.ACTIVE) {
            await subscriptionEntitlementService.assertNoteFeature(
                String(existing.stickyNoteId),
                FeatureCode.NOTES,
            );
        }

        if (existing.status === status) {
            if (status === StickyNoteFavoriteStatus.ACTIVE) {
                throw new AppError(StickyNoteFavoriteMessages.ALREADY_FAVORITED, 400);
            }

            if (status === StickyNoteFavoriteStatus.DELETED) {
                throw new AppError(StickyNoteFavoriteMessages.ALREADY_DELETED, 400);
            }
        }

        const oldStatus = existing.status;

        const favorite = await this.stickyNoteFavoriteRepository.updateStatus(
            existing._id.toString(),
            userId,
            status,
        );

        if (!favorite) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logStatusChange(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_FAVORITE,
                resourceId: favorite._id.toString(),
                resourceName: `Sticky Note Favorite`,
            },
            "status",
            oldStatus,
            status,
            `Sticky note favorite status was changed from "${oldStatus}" to "${status}".`,
        );

        return this.enrichFavorite(favorite, userId);
    }

    async deleteStickyNoteFavorite(
        id: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteFavoriteMessages.INVALID_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        let existing = await this.stickyNoteFavoriteRepository.findById(id, userId);

        if (!existing) {
            existing = await this.stickyNoteFavoriteRepository.findByStickyNote(id, userId);
        }

        if (!existing) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);

        const favorite = await this.stickyNoteFavoriteRepository.softDelete(existing._id.toString(), userId);

        if (!favorite) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.STICKY_NOTE_FAVORITE,
                resourceId: favorite._id.toString(),
                resourceName: `Sticky Note Favorite`,
            },
            `Sticky note was removed from favorites successfully.`,
        );

        return this.enrichFavorite(favorite, userId);
    }

    async restoreStickyNoteFavorite(
        id: string,
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError(StickyNoteFavoriteMessages.INVALID_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(StickyNoteFavoriteMessages.USER_ID_REQUIRED, 400);
        }

        let existing = await this.stickyNoteFavoriteRepository.findByIdIncludingDeleted(id, userId);

        if (!existing) {
            existing = await this.stickyNoteFavoriteRepository.findByStickyNoteIncludingDeleted(id, userId);
        }

        if (!existing) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }
        await workspaceAvailabilityService.assertNoteWorkspaceAvailable(existing.stickyNoteId);

        if (existing.status !== StickyNoteFavoriteStatus.DELETED) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FAVORITED, 400);
        }

        const stickyNoteId =
            (existing.stickyNoteId as any)?._id?.toString() ?? existing.stickyNoteId?.toString();

        await this.assertStickyNoteAccess(stickyNoteId, userId);

        const favorite = await this.stickyNoteFavoriteRepository.restore(existing._id.toString(), userId);

        if (!favorite) {
            throw new AppError(StickyNoteFavoriteMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.log({
            ...context,
            action: AuditLogAction.RESTORE,
            module: AppModule.STICKY_NOTE_FAVORITE,
            resourceId: favorite._id.toString(),
            resourceName: `Sticky Note Favorite`,
            description: `Sticky note favorite was restored successfully.`,
        });

        return this.enrichFavorite(favorite, userId);
    }

    private async assertStickyNoteAccess(stickyNoteId: string, userId: string) {
        const stickyNote = await StickyNoteModel.findOne({
            _id: new Types.ObjectId(stickyNoteId),
            status: { $ne: StickyNoteStatus.TRASHED },
        })
            .select("_id workspaceId title status")
            .lean();

        if (!stickyNote) {
            throw new AppError(StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND, 404);
        }

        const userObjectId = new Types.ObjectId(userId);
        const workspace = await WorkspaceModel.findById(stickyNote.workspaceId)
            .select("_id ownerId createdBy status")
            .lean();

        if (!workspace || isWorkspaceTrashed(workspace.status)) {
            throw new AppError(StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND, 404);
        }

        const isOwnerOrCreator =
            workspace.ownerId?.toString() === userId || workspace.createdBy?.toString() === userId;

        if (!isOwnerOrCreator) {
            const isMember = await WorkspaceMemberModel.exists({
                workspaceId: stickyNote.workspaceId,
                userId: userObjectId,
                status: WorkspaceMemberStatus.ACTIVE,
            });

            if (!isMember) {
                throw new AppError(StickyNoteFavoriteMessages.STICKY_NOTE_NOT_FOUND, 404);
            }
        }

        return stickyNote;
    }

    private async enrichFavorites(
        favorites: any[],
        userId: string,
    ): Promise<IStickyNoteFavoriteResponse[]> {
        if (!favorites.length) {
            return [];
        }

        const noteIdMap = new Map<string, any>();
        const missingNoteIds: Types.ObjectId[] = [];

        for (const fav of favorites) {
            const rawNote = fav.stickyNoteId;
            if (rawNote && typeof rawNote === "object" && "_id" in rawNote) {
                noteIdMap.set(String(rawNote._id), rawNote);
            } else if (rawNote && Types.ObjectId.isValid(String(rawNote))) {
                missingNoteIds.push(new Types.ObjectId(String(rawNote)));
            }
        }

        if (missingNoteIds.length > 0) {
            const fetchedNotes = await StickyNoteModel.find({
                _id: { $in: missingNoteIds },
            })
                .lean()
                .exec();
            for (const n of fetchedNotes) {
                noteIdMap.set(String(n._id), n);
            }
        }

        const noteIds: string[] = [];
        const folderIdsSet = new Set<string>();
        const creatorUserIdsSet = new Set<string>();

        for (const note of noteIdMap.values()) {
            const nId = String(note._id);
            noteIds.push(nId);
            if (note.workspaceFolderId) {
                folderIdsSet.add(String(note.workspaceFolderId));
            }
            if (note.createdBy) {
                creatorUserIdsSet.add(String(note.createdBy));
            }
        }

        const [folderMap, creatorMap, assigneesMap, checklistsMap] = await Promise.all([
            this.stickyNoteRepository.findFolderNamesMap(Array.from(folderIdsSet)),
            this.stickyNoteRepository.findCreatorEmailsMap(Array.from(creatorUserIdsSet)),
            this.stickyNoteRepository.findAssigneesMap(noteIds),
            this.stickyNoteRepository.findChecklistsMap(noteIds),
        ]);

        const allUserIdsSet = new Set<string>(creatorUserIdsSet);
        for (const [_, noteAssignees] of assigneesMap) {
            for (const a of noteAssignees) {
                if (a.id) allUserIdsSet.add(a.id);
            }
        }
        for (const fav of favorites) {
            const uId = fav.userId?._id ? String(fav.userId._id) : String(fav.userId ?? "");
            if (uId && Types.ObjectId.isValid(uId)) {
                allUserIdsSet.add(uId);
            }
        }

        const userProfilesMap = await this.resolveUserProfilesMap(Array.from(allUserIdsSet));

        const enrichedNotesMap = new Map<string, IStickyNoteListItemResponse>();
        for (const [noteIdStr, note] of noteIdMap) {
            const folderIdStr = note.workspaceFolderId ? String(note.workspaceFolderId) : null;
            const creatorIdStr = note.createdBy ? String(note.createdBy) : null;
            const checklists = checklistsMap.get(noteIdStr) ?? [];
            const rawAssignees = assigneesMap.get(noteIdStr) ?? [];
            const enrichedAssignees: IStickyNoteAssigneeNormalized[] = rawAssignees.map((a: any) => {
                const profile = userProfilesMap.get(a.id);
                return {
                    id: a.id,
                    name: profile?.displayName || profile?.name || a.name,
                    email: profile?.email || a.email,
                    avatarUrl: profile?.avatarUrl ?? a.avatarUrl ?? null,
                    profileImage: profile?.profileImage ?? (a.avatarUrl ? { id: "", url: a.avatarUrl } : null),
                };
            });
            const creatorProfile = creatorIdStr ? userProfilesMap.get(creatorIdStr) : null;

            const mappedNote = mapStickyNoteListItem(note as IStickyNoteRecord, {
                folderName: folderIdStr ? (folderMap.get(folderIdStr) ?? null) : null,
                isFavorite: true,
                favoriteId: undefined,
                creatorEmail: creatorProfile?.email ?? (creatorIdStr ? (creatorMap.get(creatorIdStr) ?? null) : null),
                creatorName: creatorProfile?.displayName || creatorProfile?.name || null,
                creatorAvatarUrl: creatorProfile?.avatarUrl ?? null,
                creatorProfileImage: creatorProfile?.profileImage ?? null,
                creator: creatorProfile
                    ? {
                          id: creatorProfile.id,
                          name: creatorProfile.displayName || creatorProfile.name,
                          email: creatorProfile.email,
                          avatarUrl: creatorProfile.avatarUrl,
                          profileImage: creatorProfile.profileImage,
                      }
                    : null,
                assignees: enrichedAssignees,
                checklists,
            });
            enrichedNotesMap.set(noteIdStr, mappedNote);
        }

        return favorites.map((fav) => {
            const favoriteId = fav._id ? fav._id.toString() : String(fav.id ?? "");
            const noteIdStr = fav.stickyNoteId?._id
                ? String(fav.stickyNoteId._id)
                : String(fav.stickyNoteId ?? "");
            const userIdStr = fav.userId?._id
                ? String(fav.userId._id)
                : String(fav.userId ?? "");

            const mappedNote = enrichedNotesMap.get(noteIdStr) ?? null;
            const noteWithFavId = mappedNote
                ? { ...mappedNote, favoriteId, isFavorite: fav.status === StickyNoteFavoriteStatus.ACTIVE }
                : null;

            return {
                id: favoriteId,
                _id: favoriteId,
                favoriteId,
                isFavorite: fav.status === StickyNoteFavoriteStatus.ACTIVE,
                stickyNoteId: noteIdStr,
                userId: userIdStr,
                status: fav.status,
                deletedAt: fav.deletedAt ?? null,
                createdAt: fav.createdAt,
                updatedAt: fav.updatedAt,
                stickyNote: noteWithFavId,
                ...(noteWithFavId ?? {}),
            };
        });
    }

    private async enrichFavorite(
        favorite: any,
        userId: string,
    ): Promise<IStickyNoteFavoriteResponse> {
        if (!favorite) return null as any;
        const [enriched] = await this.enrichFavorites([favorite], userId);
        return enriched;
    }

    private async resolveUserProfilesMap(
        userIds: string[],
    ): Promise<
        Map<
            string,
            {
                id: string;
                displayName: string;
                name: string;
                email: string;
                avatarUrl: string | null;
                profileImage: { id: string; url: string } | null;
            }
        >
    > {
        const result = new Map<
            string,
            {
                id: string;
                displayName: string;
                name: string;
                email: string;
                avatarUrl: string | null;
                profileImage: { id: string; url: string } | null;
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
                    // Gracefully skip media presign error
                }
            }
        }

        for (const idObj of validIds) {
            const idStr = idObj.toString();
            const user = userMap.get(idStr);
            const profile = profileMap.get(idStr);

            const email = String(user?.email ?? "").trim();
            const profileDisplayName = String(profile?.displayName ?? "").trim();
            const userDisplayName = String(user?.displayName ?? "").trim();
            const fullName = [
                String(profile?.firstName || user?.firstName || "").trim(),
                String(profile?.lastName || user?.lastName || "").trim(),
            ]
                .filter(Boolean)
                .join(" ");

            const displayName =
                profileDisplayName ||
                userDisplayName ||
                (fullName.length > 0 ? fullName : email ? email.split("@")[0] : "User");

            const profileImage =
                profile?.profileImage && mediaMap.has(profile.profileImage.toString())
                    ? (mediaMap.get(profile.profileImage.toString()) ?? null)
                    : null;
            const avatarUrl = profileImage?.url ?? (profile as any)?.avatarUrl ?? null;

            result.set(idStr, {
                id: idStr,
                displayName,
                name: displayName,
                email,
                avatarUrl,
                profileImage,
            });
        }

        return result;
    }
}
