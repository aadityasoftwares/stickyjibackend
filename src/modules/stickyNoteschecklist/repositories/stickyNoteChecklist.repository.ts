import {
    Types,
} from "mongoose";

import type {
    QueryFilter,
} from "mongoose";

import {
    StickyNoteChecklistModel,
} from "../models/stickyNoteChecklist.model.js";

import type {
    IStickyNoteChecklist,
    IStickyNoteChecklistFilter,
} from "../interfaces/stickyNoteChecklist.interface.js";

import {
    StickyNoteChecklistStatus,
} from "../constants/stickyNoteChecklist.enums.js";

const CHECKLIST_SELECT = {
    _id: 1,
    stickyNoteId: 1,
    title: 1,
    position: 1,
    status: 1,
    createdBy: 1,
    updatedBy: 1,
    createdAt: 1,
    updatedAt: 1,
    archivedAt: 1,
    deletedAt: 1,
} as const;

export class StickyNoteChecklistRepository {
    async create(
        data:
            Partial<IStickyNoteChecklist>,
    ) {
        return StickyNoteChecklistModel.create(
            data,
        );
    }

    async findById(
        id: string,
    ) {
        return StickyNoteChecklistModel
            .findOne({
                _id:
                    new Types.ObjectId(
                        id,
                    ),
                status: {
                    $ne:
                        StickyNoteChecklistStatus.DELETED,
                },
            })
            .select(
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }

    async findByIdIncludingDeleted(
        id: string,
    ) {
        return StickyNoteChecklistModel
            .findById(
                new Types.ObjectId(
                    id,
                ),
            )
            .select(
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }

    async findAll(
        filters:
            IStickyNoteChecklistFilter = {},
    ) {
        const {
            page = 1,
            limit = 20,
            search,
            stickyNoteId,
            status,
            createdBy,
            sortBy = "position",
            sortOrder = "asc",
        } = filters;

        const query:
            QueryFilter<IStickyNoteChecklist> =
            {};

        if (stickyNoteId) {
            query.stickyNoteId =
                stickyNoteId;
        }

        if (status) {
            query.status =
                status;
        } else {
            query.status = {
                $ne:
                    StickyNoteChecklistStatus.DELETED,
            };
        }

        if (createdBy) {
            query.createdBy =
                createdBy;
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
                StickyNoteChecklistModel
                    .find(
                        query,
                    )
                    .select(
                        CHECKLIST_SELECT,
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

                StickyNoteChecklistModel
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

    async countUsableByStickyNote(
        stickyNoteId: string,
    ): Promise<number> {
        return StickyNoteChecklistModel
            .countDocuments({
                stickyNoteId:
                    new Types.ObjectId(
                        stickyNoteId,
                    ),
                status: {
                    $in: [
                        StickyNoteChecklistStatus.ACTIVE,
                        StickyNoteChecklistStatus.ARCHIVED,
                    ],
                },
            })
            .exec();
    }

    async getNextPositionByStickyNote(
        stickyNoteId: string,
    ): Promise<number> {
        const lastChecklist =
            await StickyNoteChecklistModel
                .findOne({
                    stickyNoteId:
                        new Types.ObjectId(
                            stickyNoteId,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistStatus.DELETED,
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

        return lastChecklist
            ? lastChecklist.position + 1
            : 0;
    }

    async existsByTitle(
        stickyNoteId: string,
        title: string,
        excludeId?: string,
    ): Promise<boolean> {
        const query:
            QueryFilter<IStickyNoteChecklist> =
        {
            stickyNoteId:
                new Types.ObjectId(
                    stickyNoteId,
                ),
            title:
                title.trim(),
            status: {
                $ne:
                    StickyNoteChecklistStatus.DELETED,
            },
        };

        if (excludeId) {
            query._id = {
                $ne:
                    new Types.ObjectId(
                        excludeId,
                    ),
            };
        }

        const exists =
            await StickyNoteChecklistModel
                .exists(
                    query,
                )
                .collation({
                    locale:
                        "en",
                    strength:
                        2,
                });

        return !!exists;
    }

    async existsById(
        id: string,
    ): Promise<boolean> {
        const exists =
            await StickyNoteChecklistModel
                .exists({
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                });

        return !!exists;
    }

    async updateById(
        id: string,
        data:
            Partial<IStickyNoteChecklist>,
    ) {
        return StickyNoteChecklistModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistStatus.DELETED,
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
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }

    async updateStatus(
        id: string,
        status:
            StickyNoteChecklistStatus,
        updatedBy?:
            IStickyNoteChecklist["updatedBy"],
    ) {
        const statusFields =
            status ===
                StickyNoteChecklistStatus.ARCHIVED
                ? {
                    archivedAt:
                        new Date(),
                }
                : {
                    archivedAt:
                        null,
                };

        return StickyNoteChecklistModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistStatus.DELETED,
                    },
                },
                {
                    $set: {
                        status,
                        ...statusFields,
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
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }

    async softDelete(
        id: string,
        updatedBy?:
            IStickyNoteChecklist["updatedBy"],
    ) {
        return StickyNoteChecklistModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status: {
                        $ne:
                            StickyNoteChecklistStatus.DELETED,
                    },
                },
                {
                    $set: {
                        status:
                            StickyNoteChecklistStatus.DELETED,
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
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }

    async restore(
        id: string,
        updatedBy?:
            IStickyNoteChecklist["updatedBy"],
    ) {
        return StickyNoteChecklistModel
            .findOneAndUpdate(
                {
                    _id:
                        new Types.ObjectId(
                            id,
                        ),
                    status:
                        StickyNoteChecklistStatus.DELETED,
                },
                {
                    $set: {
                        status:
                            StickyNoteChecklistStatus.ACTIVE,
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
                CHECKLIST_SELECT,
            )
            .lean()
            .exec();
    }
}
