import { Types, type PopulateOptions, type QueryFilter } from "mongoose";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";

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

        const skip = (page - 1) * limit;
        const unavailableWorkspaceIds = await new WorkspaceRepository().findUnavailableIds();
        if (unavailableWorkspaceIds.length) {
            const notes = await StickyNoteModel.find({ workspaceId: { $in: unavailableWorkspaceIds } })
                .select("_id")
                .lean()
                .exec();
            query.$and = [{ stickyNoteId: { $nin: notes.map((note) => note._id) } }];
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
