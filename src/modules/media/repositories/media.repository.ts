import { Types } from "mongoose";
import { MediaModel } from "../models/media.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { WORKSPACE_TRASH_STATUSES } from "../../workspace/constants/workspace.enums.js";
import { MediaResourceType, MediaStatus } from "../constants/media.enums.js";
import type { IMedia, IMediaFilter } from "../interfaces/media.interface.js";

export class MediaRepository {
    async findPendingStorageDeletions(limit = 100) {
        return MediaModel.find({
            status: { $in: [MediaStatus.DELETED, MediaStatus.FAILED] },
            storageDeletionPending: true,
            $or: [
                { uploadUrlExpiresAt: null },
                { uploadUrlExpiresAt: { $lt: new Date(Date.now() - 3600000) } },
            ],
        })
            .sort({ deletedAt: 1, _id: 1 })
            .limit(limit)
            .lean()
            .exec();
    }

    async deleteStorageTombstone(id: string) {
        return MediaModel.deleteOne({
            _id: id,
            status: { $in: [MediaStatus.DELETED, MediaStatus.FAILED] },
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

    async findByOperationId(uploadOperationId: string) {
        return MediaModel.findOne({ uploadOperationId }).exec();
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
        if (filters.tenantId && filters.workspaceId) {
            query.$or = [
                { tenantId: filters.tenantId, workspaceId: filters.workspaceId },
                { tenantId: null, storageKeyVersion: { $ne: 2 } },
            ];
        } else {
            query.resourceType = { $in: [MediaResourceType.USER, null] };
            query.tenantId = null;
        }

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

        // Availability and membership are resolved before entering this repository.
        query.storageDeletionPending = { $ne: true };

        const [data, total] = await Promise.all([
            MediaModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                    _id: 1,
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

    async updateStatusFromPending(id: string, newStatus: MediaStatus, additionalData: Partial<IMedia> = {}) {
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
