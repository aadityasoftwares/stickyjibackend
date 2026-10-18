import { MediaModel } from "../models/media.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";
import { WORKSPACE_TRASH_STATUSES } from "../../workspace/constants/workspace.enums.js";
import { MediaResourceType } from "../constants/media.enums.js";

import type {
    IMedia,
    IMediaFilter,
} from "../interfaces/media.interface.js";

import { MediaStatus } from "../constants/media.enums.js";

export class MediaRepository {
    async findPendingStorageDeletions() {
        return MediaModel.find({ status: MediaStatus.DELETED, storageDeletionPending: true })
            .sort({ deletedAt: 1, _id: 1 }).limit(100).select("_id bucket storageKey").lean().exec();
    }

    async deleteStorageTombstone(id: string) {
        return MediaModel.deleteOne({ _id: id, status: MediaStatus.DELETED, storageDeletionPending: true }).exec();
    }
    async create(data: Partial<IMedia>) {
        return MediaModel.create(data);
    }

    async findById(id: string) {
        return MediaModel.findOne({
            _id: id,
            status: {
                $ne: MediaStatus.DELETED,
            },
        });
    }

    async findByIdForUser(id: string, userId: string) {
        return MediaModel.findOne({
            _id: id,
            uploadedBy: userId,
            status: {
                $ne: MediaStatus.DELETED,
            },
        });
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

        const workspaces = await WorkspaceModel.find({ status: { $in: WORKSPACE_TRASH_STATUSES } }).select("_id").lean().exec();
        const workspaceIds = workspaces.map(row => row._id);
        if (workspaceIds.length) {
            const notes = await StickyNoteModel.find({ workspaceId: { $in: workspaceIds } }).select("_id").lean().exec();
            query.$nor = [
                { resourceType: MediaResourceType.WORKSPACE, resourceId: { $in: workspaceIds } },
                { resourceType: MediaResourceType.NOTE, resourceId: { $in: notes.map(row => row._id) } },
            ];
        }
        query.storageDeletionPending = { $ne: true };

        const [data, total] = await Promise.all([
            MediaModel.find(query)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),
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
                new: true,
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
            },
            {
                new: true,
                runValidators: true,
            },
        );
    }

    async findExpiredPendingUploads() {
        return MediaModel.find({
            status: MediaStatus.PENDING,
            uploadExpiresAt: {
                $lt: new Date(),
            },
        });
    }

    async deleteDocument(id: string) {
        return MediaModel.deleteOne({
            _id: id,
        });
    }
}
