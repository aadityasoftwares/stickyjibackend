import { Types, type PopulateOptions, type QueryFilter } from "mongoose";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";

import { StickyNoteFavoriteModel } from "../models/stickyNoteFavorite.model.js";

import type {
    IStickyNoteFavorite,
    IStickyNoteFavoriteFilter,
} from "../interfaces/stickyNoteFavorite.interface.js";

import { StickyNoteFavoriteStatus } from "../constants/stickyNoteFavorite.enums.js";

const STICKY_NOTE_SELECT =
    "_id workspaceId workspaceFolderId columnId stickyNoteNumber title content color priority shape variant backgroundPattern position rank status noteDate createdBy createdAt updatedAt";

const USER_SELECT = "_id firstName lastName displayName email";

const FAVORITE_POPULATE: PopulateOptions[] = [
    {
        path: "stickyNoteId",
        select: STICKY_NOTE_SELECT,
    },
    {
        path: "userId",
        select: USER_SELECT,
    },
];

export class StickyNoteFavoriteRepository {
    async create(data: Partial<IStickyNoteFavorite>) {
        return StickyNoteFavoriteModel.create(data);
    }

    async findById(id: string, userId: string) {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOne({
            _id: new Types.ObjectId(id),
            userId: new Types.ObjectId(userId),
            status: {
                $ne: StickyNoteFavoriteStatus.DELETED,
            },
        })
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async findByIdIncludingDeleted(id: string, userId: string) {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOne({
            _id: new Types.ObjectId(id),
            userId: new Types.ObjectId(userId),
        })
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async findByStickyNote(stickyNoteId: string, userId: string) {
        if (!Types.ObjectId.isValid(stickyNoteId) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOne({
            stickyNoteId: new Types.ObjectId(stickyNoteId),
            userId: new Types.ObjectId(userId),
            status: {
                $ne: StickyNoteFavoriteStatus.DELETED,
            },
        })
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async findByStickyNoteIncludingDeleted(stickyNoteId: string, userId: string) {
        if (!Types.ObjectId.isValid(stickyNoteId) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOne({
            stickyNoteId: new Types.ObjectId(stickyNoteId),
            userId: new Types.ObjectId(userId),
        })
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async findAll(filters: IStickyNoteFavoriteFilter = {}) {
        const {
            page = 1,
            limit = 10,
            stickyNoteId,
            userId,
            workspaceId,
            workspaceFolderId,
            search,
            status,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: QueryFilter<IStickyNoteFavorite> = {};

        if (stickyNoteId && Types.ObjectId.isValid(String(stickyNoteId))) {
            query.stickyNoteId = new Types.ObjectId(String(stickyNoteId));
        }

        if (userId && Types.ObjectId.isValid(String(userId))) {
            query.userId = new Types.ObjectId(String(userId));
        }

        if (status) {
            query.status = status;
        } else {
            query.status = {
                $ne: StickyNoteFavoriteStatus.DELETED,
            } as any;
        }

        const noteFilter: any = {
            status: { $ne: StickyNoteStatus.TRASHED },
        };
        let shouldFilterNotes = false;
        if (workspaceId && Types.ObjectId.isValid(String(workspaceId))) {
            noteFilter.workspaceId = new Types.ObjectId(String(workspaceId));
            shouldFilterNotes = true;
        }
        if (workspaceFolderId && Types.ObjectId.isValid(String(workspaceFolderId))) {
            noteFilter.workspaceFolderId = new Types.ObjectId(String(workspaceFolderId));
            shouldFilterNotes = true;
        }
        if (search && String(search).trim()) {
            const regex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            noteFilter.$or = [{ title: regex }, { content: regex }];
            shouldFilterNotes = true;
        }

        if (shouldFilterNotes) {
            const matchedNotes = await StickyNoteModel.find(noteFilter).select("_id").lean().exec();
            query.stickyNoteId = { $in: matchedNotes.map((n) => n._id) };
        }

        const skip = (page - 1) * limit;
        const [trashedNotes, unavailableWorkspaceIds] = await Promise.all([
            StickyNoteModel.find({ status: StickyNoteStatus.TRASHED }).select("_id").lean().exec(),
            new WorkspaceRepository().findUnavailableIds(),
        ]);
        const excludeNoteIds: Types.ObjectId[] = trashedNotes.map((note) => note._id);
        if (unavailableWorkspaceIds.length) {
            const unavailableNotes = await StickyNoteModel.find({ workspaceId: { $in: unavailableWorkspaceIds } })
                .select("_id")
                .lean()
                .exec();
            excludeNoteIds.push(...unavailableNotes.map((note) => note._id));
        }
        if (excludeNoteIds.length) {
            if (query.stickyNoteId && typeof query.stickyNoteId === "object" && "$in" in query.stickyNoteId) {
                const allowed = (query.stickyNoteId as any).$in.filter(
                    (id: Types.ObjectId) => !excludeNoteIds.some((ex) => ex.equals(id)),
                );
                query.stickyNoteId = { $in: allowed };
            } else {
                query.$and = [{ stickyNoteId: { $nin: excludeNoteIds } }];
            }
        }
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        const [data, total] = await Promise.all([
            StickyNoteFavoriteModel.find(query)
                .populate(FAVORITE_POPULATE)
                .sort({
                    [sortBy]: sortDirection,
                })
                .skip(skip)
                .limit(limit)
                .lean(),

            StickyNoteFavoriteModel.countDocuments(query),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async existsByStickyNote(stickyNoteId: string, userId: string, excludeId?: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(stickyNoteId) || !Types.ObjectId.isValid(userId)) {
            return false;
        }

        const query: Record<string, unknown> = {
            stickyNoteId: new Types.ObjectId(stickyNoteId),
            userId: new Types.ObjectId(userId),
            status: {
                $ne: StickyNoteFavoriteStatus.DELETED,
            },
        };

        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = {
                $ne: new Types.ObjectId(excludeId),
            };
        }

        const exists = await StickyNoteFavoriteModel.exists(query);

        return Boolean(exists);
    }

    async existsById(id: string, userId?: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(id)) {
            return false;
        }

        const query: Record<string, unknown> = {
            _id: new Types.ObjectId(id),
        };

        if (userId && Types.ObjectId.isValid(userId)) {
            query.userId = new Types.ObjectId(userId);
        }

        const exists = await StickyNoteFavoriteModel.exists(query);

        return Boolean(exists);
    }

    async updateById(id: string, userId: string, data: Partial<IStickyNoteFavorite>) {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                userId: new Types.ObjectId(userId),
                status: {
                    $ne: StickyNoteFavoriteStatus.DELETED,
                },
            },
            { $set: data },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async updateStatus(id: string, userId: string, status: StickyNoteFavoriteStatus) {
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
            return null;
        }

        return StickyNoteFavoriteModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                userId: new Types.ObjectId(userId),
            },
            {
                $set: {
                    status,
                    ...(status === StickyNoteFavoriteStatus.DELETED
                        ? {
                              deletedAt: new Date(),
                          }
                        : {
                              deletedAt: null,
                          }),
                },
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate(FAVORITE_POPULATE)
            .lean();
    }

    async softDelete(id: string, userId: string) {
        return this.updateStatus(id, userId, StickyNoteFavoriteStatus.DELETED);
    }

    async restore(id: string, userId: string) {
        return this.updateStatus(id, userId, StickyNoteFavoriteStatus.ACTIVE);
    }
}
