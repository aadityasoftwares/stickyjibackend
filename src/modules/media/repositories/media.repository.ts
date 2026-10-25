import { Types } from "mongoose";
import { MediaModel } from "../models/media.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { WORKSPACE_TRASH_STATUSES } from "../../workspace/constants/workspace.enums.js";
import { MediaResourceType, MediaStatus } from "../constants/media.enums.js";
import type { IMedia, IMediaFilter } from "../interfaces/media.interface.js";

export class MediaRepository {
    async findPendingStorageDeletions(limit = 100) {
        return MediaModel.find({ status: MediaStatus.DELETED, storageDeletionPending: true })
            .sort({ deletedAt: 1, _id: 1 })
            .limit(limit)
            .select("_id bucket storageKey")
            .lean()
            .exec();
    }

    async deleteStorageTombstone(id: string) {
        return MediaModel.deleteOne({
            _id: id,
            status: MediaStatus.DELETED,
            storageDeletionPending: true,
        }).exec();
    }

    async isStorageKeyReferencedElsewhere(storageKey: string, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = {
            storageKey,
            status: { $ne: MediaStatus.DELETED },
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const count = await MediaModel.countDocuments(query);
        return count > 0;
    }

    async create(data: Partial<IMedia>) {
        return MediaModel.create(data);
    }

    async findById(id: string, lean = false) {
        const query = MediaModel.findOne({
            _id: id,
            status: {
                $ne: MediaStatus.DELETED,
            },
        });
        if (lean) {
            query.lean();
        }
        return query.exec();
    }

    async findByIdForUser(id: string, userId: string, lean = false) {
        const query = MediaModel.findOne({
            _id: id,
            uploadedBy: userId,
            status: {
                $ne: MediaStatus.DELETED,
            },
        });
        if (lean) {
            query.lean();
        }
        return query.exec();
    }

    async findAll(filters: IMediaFilter = {}) {
        const {
            uploadedBy,
            mediaType,
            purpose,
            visibility,
            status,
            resourceType,
            resourceId,
            search,
            page = 1,
            limit = 10,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: Record<string, unknown> = {};

        if (uploadedBy) {
            query.uploadedBy = uploadedBy;
        }

        if (mediaType) {
            query.mediaType = mediaType;
        }

        if (purpose) {
            query.purpose = purpose;
        }

        if (visibility) {
            query.visibility = visibility;
        }

        query.status = status ?? {
            $ne: MediaStatus.DELETED,
        };

        if (resourceType) {
            query.resourceType = resourceType;
        }

        if (resourceId) {
            query.resourceId = resourceId;
        }

        if (search) {
            query.originalFileName = {
                $regex: search,
                $options: "i",
            };
        }

        const skip = (page - 1) * limit;

        const workspaces = await WorkspaceModel.find({ status: { $in: WORKSPACE_TRASH_STATUSES } })
            .select("_id")
            .lean()
            .exec();
        const workspaceIds = workspaces.map((row) => row._id);
        if (workspaceIds.length) {
            const notes = await StickyNoteModel.find({ workspaceId: { $in: workspaceIds } })
                .select("_id")
                .lean()
                .exec();
            query.$nor = [
                { resourceType: MediaResourceType.WORKSPACE, resourceId: { $in: workspaceIds } },
                { resourceType: MediaResourceType.NOTE, resourceId: { $in: notes.map((row) => row._id) } },
            ];
        }
        query.storageDeletionPending = { $ne: true };

        const [data, total] = await Promise.all([
            MediaModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            MediaModel.countDocuments(query),
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

    async updateById(id: string, data: Partial<IMedia>) {
        return MediaModel.findOneAndUpdate(
            {
                _id: id,
                status: {
                    $ne: MediaStatus.DELETED,
                },
            },
            data,
            {
                returnDocument: "after",
                runValidators: true,
            },
        );
    }

    async updateStatusFromPending(
        id: string,
        newStatus: MediaStatus,
        additionalData: Partial<IMedia> = {},
    ) {
        return MediaModel.findOneAndUpdate(
            {
                _id: id,
                status: MediaStatus.PENDING,
            },
            {
                $set: {
                    status: newStatus,
                    ...additionalData,
                },
            },
            {
                returnDocument: "after",
                runValidators: true,
            },
        );
    }

    async markDeleted(id: string) {
        return MediaModel.findOneAndUpdate(
            {
                _id: id,
                status: {
                    $ne: MediaStatus.DELETED,
                },
            },
            {
                status: MediaStatus.DELETED,
                deletedAt: new Date(),
                storageDeletionPending: true,
                publicUrl: null,
            },
            {
                returnDocument: "after",
                runValidators: true,
            },
        );
    }

    async findExpiredPendingUploads(limit = 100) {
        return MediaModel.find({
            status: MediaStatus.PENDING,
            uploadExpiresAt: {
                $lt: new Date(),
            },
        })
            .limit(limit)
            .lean()
            .exec();
    }

    async deleteDocument(id: string) {
        return MediaModel.deleteOne({
            _id: id,
        });
    }
}
