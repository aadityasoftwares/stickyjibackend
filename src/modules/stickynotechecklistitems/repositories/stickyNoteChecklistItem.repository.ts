import {
    Types,
} from "mongoose";

import type {
    QueryFilter,
} from "mongoose";

import {
    StickyNoteChecklistItemModel,
} from "../models/stickyNoteChecklistItem.model.js";

import type {
    IStickyNoteChecklistItem,
    IStickyNoteChecklistItemFilter,
} from "../interfaces/stickyNoteChecklistItem.interface.js";

import {
    StickyNoteChecklistItemStatus,
} from "../constants/stickyNoteChecklistItem.enums.js";

const ITEM_SELECT = {
    _id: 1,
    checklistId: 1,
    title: 1,
    position: 1,
    isCompleted: 1,
    status: 1,
    createdBy: 1,
    updatedBy: 1,
    completedBy: 1,
    completedAt: 1,
    archivedAt: 1,
    deletedAt: 1,
    createdAt: 1,
    updatedAt: 1,
} as const;

export class StickyNoteChecklistItemRepository {
    async create(
        data:
            Partial<IStickyNoteChecklistItem>,
    ) {
        return StickyNoteChecklistItemModel.create(
            data,
        );
    }

    async findById(
        id: string,
    ) {
        return StickyNoteChecklistItemModel
            .findOne({
                _id:
                    new Types.ObjectId(
                        id,
                    ),
                status: {
                    $ne:
                        StickyNoteChecklistItemStatus.DELETED,
                },
            })
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async findByIdIncludingDeleted(
        id: string,
    ) {
        return StickyNoteChecklistItemModel
            .findById(
                new Types.ObjectId(
                    id,
                ),
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async findAll(
        filters:
            IStickyNoteChecklistItemFilter = {},
    ) {
        const {
            page = 1,
            limit = 50,
            search,
            checklistId,
            status,
            isCompleted,
            createdBy,
            completedBy,
            sortBy = "position",
            sortOrder = "asc",
        } = filters;

        const query:
            QueryFilter<IStickyNoteChecklistItem> =
            {};

        if (checklistId) {
            query.checklistId =
                checklistId;
        }

        if (status) {
            query.status =
                status;
        } else {
            query.status = {
                $ne:
                    StickyNoteChecklistItemStatus.DELETED,
            };
        }

        if (
            isCompleted !==
            undefined
        ) {
            query.isCompleted =
                isCompleted;
        }

        if (createdBy) {
            query.createdBy =
                createdBy;
        }

        if (completedBy) {
            query.completedBy =
                completedBy;
        }

        if (search) {
            const escapedSearch =
                search.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                );

            query.title = {
                $regex:
                    escapedSearch,
                $options:
                    "i",
            };
        }

        const skip =
            (page - 1) * limit;

        const sortDirection =
            sortOrder === "asc"
                ? 1
                : -1;

        const [data, total] =
            await Promise.all([
                StickyNoteChecklistItemModel
                    .find(
                        query,
                    )
                    .select(
                        ITEM_SELECT,
                    )
                    .sort({
                        [sortBy]:
                            sortDirection,
                        _id: 1,
                    })
                    .skip(
                        skip,
                    )
                    .limit(
                        limit,
                    )
                    .lean()
                    .exec(),

                StickyNoteChecklistItemModel
                    .countDocuments(
                        query,
                    )
                    .exec(),
            ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages:
                    Math.ceil(
                        total /
                        limit,
                    ),
            },
        };
    }

    async countUsableByChecklist(
        checklistId: string,
    ): Promise<number> {
        return StickyNoteChecklistItemModel
            .countDocuments({
                checklistId:
                    new Types.ObjectId(
                        checklistId,
                    ),
                status: {
                    $in: [
                        StickyNoteChecklistItemStatus.ACTIVE,
                        StickyNoteChecklistItemStatus.ARCHIVED,
                    ],
                },
            })
            .exec();
    }

    async getNextPositionByChecklist(
        checklistId: string,
    ): Promise<number> {
        const lastItem =
            await StickyNoteChecklistItemModel
                .findOne({
                    checklistId:
                        new Types.ObjectId(
                            checklistId,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistItemStatus.DELETED,
                    },
                })
                .sort({
                    position:
                        -1,
                    _id:
                        -1,
                })
                .select({
                    position:
                        1,
                })
                .lean()
                .exec();

        return lastItem
            ? lastItem.position + 1
            : 0;
    }

    async updateById(
        id: string,
        data:
            Partial<IStickyNoteChecklistItem>,
    ) {
        return StickyNoteChecklistItemModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistItemStatus.DELETED,
                    },
                },
                {
                    $set:
                        data,
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async updateStatus(
        id: string,
        status:
            StickyNoteChecklistItemStatus,
        updatedBy?:
            IStickyNoteChecklistItem["updatedBy"],
    ) {
        const archivedAt =
            status ===
                StickyNoteChecklistItemStatus.ARCHIVED
                ? new Date()
                : null;

        return StickyNoteChecklistItemModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistItemStatus.DELETED,
                    },
                },
                {
                    $set: {
                        status,
                        archivedAt,
                        ...(updatedBy !==
                            undefined
                            ? {
                                updatedBy,
                            }
                            : {}),
                    },
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async updateCompletion(
        id: string,
        isCompleted: boolean,
        updatedBy?:
            IStickyNoteChecklistItem["updatedBy"],
    ) {
        return StickyNoteChecklistItemModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistItemStatus.DELETED,
                    },
                },
                {
                    $set: {
                        isCompleted,
                        completedAt:
                            isCompleted
                                ? new Date()
                                : null,
                        completedBy:
                            isCompleted
                                ? updatedBy ??
                                null
                                : null,
                        ...(updatedBy !==
                            undefined
                            ? {
                                updatedBy,
                            }
                            : {}),
                    },
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async findCompletionStateById(
        id: string,
    ) {
        return StickyNoteChecklistItemModel
            .findOne({
                _id:
                    new Types.ObjectId(
                        id,
                    ),
                status: {
                    $ne:
                        StickyNoteChecklistItemStatus.DELETED,
                },
            })
            .select({
                _id:
                    1,
                checklistId:
                    1,
                title:
                    1,
                isCompleted:
                    1,
                completedAt:
                    1,
                completedBy:
                    1,
                updatedBy:
                    1,
            })
            .lean()
            .exec();
    }

    async restoreCompletionState(
        id: string,
        state: {
            isCompleted: boolean;
            completedAt?: Date | null;
            completedBy?:
            IStickyNoteChecklistItem["completedBy"];
            updatedBy?:
            IStickyNoteChecklistItem["updatedBy"];
        },
    ) {
        return StickyNoteChecklistItemModel
            .findByIdAndUpdate(
                new Types.ObjectId(
                    id,
                ),
                {
                    $set: {
                        isCompleted:
                            state.isCompleted,
                        completedAt:
                            state.completedAt ??
                            null,
                        completedBy:
                            state.completedBy ??
                            null,
                        updatedBy:
                            state.updatedBy ??
                            null,
                    },
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async softDelete(
        id: string,
        updatedBy?:
            IStickyNoteChecklistItem["updatedBy"],
    ) {
        return StickyNoteChecklistItemModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistItemStatus.DELETED,
                    },
                },
                {
                    $set: {
                        status:
                            StickyNoteChecklistItemStatus.DELETED,
                        deletedAt:
                            new Date(),
                        ...(updatedBy !==
                            undefined
                            ? {
                                updatedBy,
                            }
                            : {}),
                    },
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }

    async restore(
        id: string,
        updatedBy?:
            IStickyNoteChecklistItem["updatedBy"],
    ) {
        return StickyNoteChecklistItemModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status:
                        StickyNoteChecklistItemStatus.DELETED,
                },
                {
                    $set: {
                        status:
                            StickyNoteChecklistItemStatus.ACTIVE,
                        deletedAt:
                            null,
                        archivedAt:
                            null,
                        ...(updatedBy !==
                            undefined
                            ? {
                                updatedBy,
                            }
                            : {}),
                    },
                },
                {
                    new:
                        true,
                    runValidators:
                        true,
                },
            )
            .select(
                ITEM_SELECT,
            )
            .lean()
            .exec();
    }
}
