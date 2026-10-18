import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { StickyNoteLabelModel } from "../models/stickyNoteLabel.model.js";

import type { IStickyNoteLabel, IStickyNoteLabelFilter } from "../interfaces/stickyNoteLabel.interface.js";

import { StickyNoteLabelStatus } from "../constants/stickyNoteLabel.enums.js";

export class StickyNoteLabelRepository {
    async create(data: Partial<IStickyNoteLabel>) {
        return StickyNoteLabelModel.create(data);
    }

    async findById(id: string) {
        return StickyNoteLabelModel.findOne({
            _id: id,
            status: {
                $ne: StickyNoteLabelStatus.DELETED,
            },
        })
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async findByIdIncludingDeleted(id: string) {
        return StickyNoteLabelModel.findById(id)
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async findBySlug(workspaceId: string, slug: string) {
        return StickyNoteLabelModel.findOne({
            workspaceId,
            slug: slug.toLowerCase().trim(),
            status: {
                $ne: StickyNoteLabelStatus.DELETED,
            },
        })
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async findAll(filters: IStickyNoteLabelFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            workspaceId,
            color,
            status,
            createdBy,
            sortBy = "position",
            sortOrder = "asc",
        } = filters;

        const query: Record<string, unknown> = {};

        if (search) {
            query.$or = [
                {
                    name: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    slug: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        if (color) {
            query.color = color;
        }

        if (status) {
            query.status = status;
        }

        if (createdBy) {
            query.createdBy = createdBy;
        }

        if (!workspaceId) {
            query.$and = [
                ...(Array.isArray(query.$and) ? query.$and : []),
                { workspaceId: { $nin: await new WorkspaceRepository().findUnavailableIds() } },
            ];
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            StickyNoteLabelModel.find(query)
                .populate("workspaceId")
                .populate("createdBy")
                .populate("updatedBy")
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),

            StickyNoteLabelModel.countDocuments(query),
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

    async existsBySlug(workspaceId: any, slug: string, excludeId?: string): Promise<boolean> {
        const query: Record<any, unknown> = {
            workspaceId,
            slug: slug.toLowerCase().trim(),
            status: {
                $ne: StickyNoteLabelStatus.DELETED,
            },
        };

        if (excludeId) {
            query._id = {
                $ne: excludeId,
            };
        }

        const exists = await StickyNoteLabelModel.exists(query);

        return !!exists;
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await StickyNoteLabelModel.exists({
            _id: id,
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<IStickyNoteLabel>) {
        return StickyNoteLabelModel.findOneAndUpdate(
            {
                _id: id,
                status: {
                    $ne: StickyNoteLabelStatus.DELETED,
                },
            },
            data,
            {
                new: true,
                runValidators: true,
            },
        )
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async updateStatus(id: string, status: StickyNoteLabelStatus, updatedBy?: IStickyNoteLabel["updatedBy"]) {
        return StickyNoteLabelModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                status,
                ...(status === StickyNoteLabelStatus.ARCHIVED
                    ? {
                          archivedAt: new Date(),
                      }
                    : {
                          archivedAt: null,
                      }),
                ...(status === StickyNoteLabelStatus.DELETED
                    ? {
                          deletedAt: new Date(),
                      }
                    : {}),
                ...(updatedBy !== undefined
                    ? {
                          updatedBy,
                      }
                    : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async softDelete(id: string, updatedBy?: IStickyNoteLabel["updatedBy"]) {
        return StickyNoteLabelModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                status: StickyNoteLabelStatus.DELETED,
                deletedAt: new Date(),
                ...(updatedBy !== undefined
                    ? {
                          updatedBy,
                      }
                    : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }

    async restore(id: string, updatedBy?: IStickyNoteLabel["updatedBy"]) {
        return StickyNoteLabelModel.findOneAndUpdate(
            {
                _id: id,
                status: StickyNoteLabelStatus.DELETED,
            },
            {
                status: StickyNoteLabelStatus.ACTIVE,
                deletedAt: null,
                ...(updatedBy !== undefined
                    ? {
                          updatedBy,
                      }
                    : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate("workspaceId")
            .populate("createdBy")
            .populate("updatedBy");
    }
}
