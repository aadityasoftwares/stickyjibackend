import {
    Types,
} from "mongoose";

import type {
    AnyBulkWriteOperation,
    ClientSession,
    PopulateOptions,
    QueryFilter,
} from "mongoose";

import {
    StickyNoteAssigneeStatus,
} from "../constants/stickyNoteAssignee.enums.js";

import type {
    IStickyNoteAssignee,
    IStickyNoteAssigneeDocument,
    IStickyNoteAssigneeFilter,
} from "../interfaces/stickyNoteAssignee.interface.js";

import {
    StickyNoteAssigneeModel,
} from "../models/stickyNoteAssignee.model.js";

const STICKY_NOTE_ASSIGNEE_SELECT = [
    "workspaceId",
    "stickyNoteId",
    "userId",
    "status",
    "assignedBy",
    "removedBy",
    "assignedAt",
    "removedAt",
    "createdAt",
    "updatedAt",
].join(" ");

const USER_SELECT =
    "_id firstName lastName displayName email";

const ASSIGNEE_USER_POPULATE:
    PopulateOptions[] = [
        {
            path: "userId",
            select: USER_SELECT,
        },
    ];

const ASSIGNEE_DETAIL_POPULATE:
    PopulateOptions[] = [
        ...ASSIGNEE_USER_POPULATE,
        {
            path: "assignedBy",
            select: USER_SELECT,
        },
        {
            path: "removedBy",
            select: USER_SELECT,
        },
    ];

export class StickyNoteAssigneeRepository {
    async findById(
        id: string,
    ) {
        return StickyNoteAssigneeModel
            .findById(id)
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_DETAIL_POPULATE,
            )
            .exec();
    }

    async findByNoteAndUser(
        stickyNoteId: string,
        userId: string,
    ) {
        return StickyNoteAssigneeModel
            .findOne({
                stickyNoteId:
                    new Types.ObjectId(
                        stickyNoteId,
                    ),
                userId:
                    new Types.ObjectId(
                        userId,
                    ),
            })
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_DETAIL_POPULATE,
            )
            .exec();
    }

    async createOrReactivate(
        workspaceId: string,
        stickyNoteId: string,
        userId: string,
        assignedBy: string,
        session?: ClientSession,
    ) {
        const now =
            new Date();

        const query =
            StickyNoteAssigneeModel
                .findOneAndUpdate(
                    {
                        stickyNoteId:
                            new Types.ObjectId(
                                stickyNoteId,
                            ),
                        userId:
                            new Types.ObjectId(
                                userId,
                            ),
                    },
                    {
                        $set: {
                            workspaceId:
                                new Types.ObjectId(
                                    workspaceId,
                                ),
                            status:
                                StickyNoteAssigneeStatus.ACTIVE,
                            assignedBy:
                                new Types.ObjectId(
                                    assignedBy,
                                ),
                            assignedAt:
                                now,
                            removedBy:
                                null,
                            removedAt:
                                null,
                        },
                    },
                    {
                        new: true,
                        upsert: true,
                        setDefaultsOnInsert: true,
                        runValidators: true,
                    },
                );

        if (session) {
            query.session(session);
        }

        return query
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_DETAIL_POPULATE,
            )
            .exec();
    }

    async removeById(
        id: string,
        removedBy: string,
        session?: ClientSession,
    ) {
        const query =
            StickyNoteAssigneeModel
                .findOneAndUpdate(
                    {
                        _id:
                            new Types.ObjectId(
                                id,
                            ),
                        status:
                            StickyNoteAssigneeStatus.ACTIVE,
                    },
                    {
                        $set: {
                            status:
                                StickyNoteAssigneeStatus.REMOVED,
                            removedBy:
                                new Types.ObjectId(
                                    removedBy,
                                ),
                            removedAt:
                                new Date(),
                        },
                    },
                    {
                        new: true,
                        runValidators: true,
                    },
                );

        if (session) {
            query.session(session);
        }

        return query
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_DETAIL_POPULATE,
            )
            .exec();
    }

    async restoreById(
        id: string,
        assignedBy: string,
        session?: ClientSession,
    ) {
        const query =
            StickyNoteAssigneeModel
                .findOneAndUpdate(
                    {
                        _id:
                            new Types.ObjectId(
                                id,
                            ),
                        status:
                            StickyNoteAssigneeStatus.REMOVED,
                    },
                    {
                        $set: {
                            status:
                                StickyNoteAssigneeStatus.ACTIVE,
                            assignedBy:
                                new Types.ObjectId(
                                    assignedBy,
                                ),
                            assignedAt:
                                new Date(),
                            removedBy:
                                null,
                            removedAt:
                                null,
                        },
                    },
                    {
                        new: true,
                        runValidators: true,
                    },
                );

        if (session) {
            query.session(session);
        }

        return query
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_DETAIL_POPULATE,
            )
            .exec();
    }

    async findAll(
        filters:
            IStickyNoteAssigneeFilter = {},
    ) {
        const {
            page = 1,
            limit = 20,
            workspaceId,
            stickyNoteId,
            userId,
            status =
            StickyNoteAssigneeStatus.ACTIVE,
            sortBy = "assignedAt",
            sortOrder = "desc",
        } = filters;

        const query:
            QueryFilter<IStickyNoteAssignee> = {};

        if (workspaceId) {
            query.workspaceId =
                new Types.ObjectId(
                    String(workspaceId),
                );
        }

        if (stickyNoteId) {
            query.stickyNoteId =
                new Types.ObjectId(
                    String(stickyNoteId),
                );
        }

        if (userId) {
            query.userId =
                new Types.ObjectId(
                    String(userId),
                );
        }

        if (status) {
            query.status = status;
        }

        const skip =
            (page - 1) * limit;

        const sortDirection =
            sortOrder === "asc"
                ? 1
                : -1;

        const [data, total] =
            await Promise.all([
                StickyNoteAssigneeModel
                    .find(query)
                    .select(
                        STICKY_NOTE_ASSIGNEE_SELECT,
                    )
                    .populate(
                        ASSIGNEE_USER_POPULATE,
                    )
                    .sort({
                        [sortBy]:
                            sortDirection,
                    })
                    .skip(skip)
                    .limit(limit)
                    .exec(),

                StickyNoteAssigneeModel
                    .countDocuments(query)
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
                        total / limit,
                    ),
            },
        };
    }

    async countActiveByStickyNote(
        stickyNoteId: string,
    ): Promise<number> {
        return StickyNoteAssigneeModel
            .countDocuments({
                stickyNoteId:
                    new Types.ObjectId(
                        stickyNoteId,
                    ),
                status:
                    StickyNoteAssigneeStatus.ACTIVE,
            })
            .exec();
    }

    async findActiveUserIdsByStickyNote(
        stickyNoteId: string,
    ): Promise<string[]> {
        const rows =
            await StickyNoteAssigneeModel
                .find({
                    stickyNoteId:
                        new Types.ObjectId(
                            stickyNoteId,
                        ),
                    status:
                        StickyNoteAssigneeStatus.ACTIVE,
                })
                .select({
                    userId: 1,
                })
                .lean()
                .exec();

        return rows.map(
            row =>
                row.userId.toString(),
        );
    }

    async findActiveByStickyNote(
        stickyNoteId: string,
    ) {
        return StickyNoteAssigneeModel
            .find({
                stickyNoteId:
                    new Types.ObjectId(
                        stickyNoteId,
                    ),
                status:
                    StickyNoteAssigneeStatus.ACTIVE,
            })
            .select(
                STICKY_NOTE_ASSIGNEE_SELECT,
            )
            .populate(
                ASSIGNEE_USER_POPULATE,
            )
            .sort({
                assignedAt: 1,
                createdAt: 1,
            })
            .exec();
    }

    async findActiveByStickyNoteIds(
        stickyNoteIds:
            readonly Types.ObjectId[],
    ) {
        if (stickyNoteIds.length === 0) {
            return [];
        }

        return StickyNoteAssigneeModel
            .find({
                stickyNoteId: {
                    $in: stickyNoteIds,
                },
                status:
                    StickyNoteAssigneeStatus.ACTIVE,
            })
            .select(
                "stickyNoteId userId assignedAt",
            )
            .populate(
                ASSIGNEE_USER_POPULATE,
            )
            .sort({
                stickyNoteId: 1,
                assignedAt: 1,
            })
            .lean()
            .exec();
    }

    async syncActiveAssignments(
        options: {
            workspaceId: string;
            stickyNoteId: string;
            addUserIds: readonly string[];
            removeUserIds: readonly string[];
            actorId: string;
        },
        session?: ClientSession,
    ) {
        const {
            workspaceId,
            stickyNoteId,
            addUserIds,
            removeUserIds,
            actorId,
        } = options;

        const now =
            new Date();

        const operations:
            AnyBulkWriteOperation<IStickyNoteAssigneeDocument>[] =
            [];

        for (
            const userId of addUserIds
        ) {
            operations.push({
                updateOne: {
                    filter: {
                        stickyNoteId:
                            new Types.ObjectId(
                                stickyNoteId,
                            ),
                        userId:
                            new Types.ObjectId(
                                userId,
                            ),
                    },
                    update: {
                        $set: {
                            workspaceId:
                                new Types.ObjectId(
                                    workspaceId,
                                ),
                            status:
                                StickyNoteAssigneeStatus.ACTIVE,
                            assignedBy:
                                new Types.ObjectId(
                                    actorId,
                                ),
                            assignedAt:
                                now,
                            removedBy:
                                null,
                            removedAt:
                                null,
                        },
                    },
                    upsert: true,
                },
            });
        }

        if (
            removeUserIds.length > 0
        ) {
            operations.push({
                updateMany: {
                    filter: {
                        stickyNoteId:
                            new Types.ObjectId(
                                stickyNoteId,
                            ),
                        userId: {
                            $in:
                                removeUserIds.map(
                                    userId =>
                                        new Types.ObjectId(
                                            userId,
                                        ),
                                ),
                        },
                        status:
                            StickyNoteAssigneeStatus.ACTIVE,
                    },
                    update: {
                        $set: {
                            status:
                                StickyNoteAssigneeStatus.REMOVED,
                            removedBy:
                                new Types.ObjectId(
                                    actorId,
                                ),
                            removedAt:
                                now,
                        },
                    },
                },
            });
        }

        if (operations.length === 0) {
            return null;
        }

        return StickyNoteAssigneeModel
            .bulkWrite(
                operations,
                {
                    ordered: false,
                    ...(session
                        ? {
                            session,
                        }
                        : {}),
                },
            );
    }

    async removeAllByWorkspaceAndUser(
        workspaceId: string,
        userId: string,
        removedBy: string,
        session?: ClientSession,
    ) {
        return StickyNoteAssigneeModel
            .updateMany(
                {
                    workspaceId:
                        new Types.ObjectId(
                            workspaceId,
                        ),
                    userId:
                        new Types.ObjectId(
                            userId,
                        ),
                    status:
                        StickyNoteAssigneeStatus.ACTIVE,
                },
                {
                    $set: {
                        status:
                            StickyNoteAssigneeStatus.REMOVED,
                        removedBy:
                            new Types.ObjectId(
                                removedBy,
                            ),
                        removedAt:
                            new Date(),
                    },
                },
                session
                    ? {
                        session,
                    }
                    : undefined,
            )
            .exec();
    }
}
