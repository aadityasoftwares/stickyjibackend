import { Types, type ClientSession } from "mongoose";
import { SubscriptionUsageModel } from "../models/subscriptionusage.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";
import { MediaModel } from "../../media/models/media.model.js";
import { UserSubscriptionModel } from "../../usersubscription/models/usersubscription.model.js";
import { WorkspaceStatus } from "../../workspace/constants/workspace.enums.js";
import { WorkspaceFolderStatus } from "../../workspaceFolders/constants/workspaceFolder.enums.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { MediaResourceType, MediaStatus } from "../../media/constants/media.enums.js";
import { BillingScopeType } from "../constants/subscriptionusage.enums.js";
import { SUBSCRIPTION_USAGE_CONSTANTS } from "../constants/subscriptionusage.constants.js";
import type {
    ISubscriptionUsageDocument,
    ISubscriptionUsageFilter,
} from "../interfaces/subscriptionusage.interface.js";

export class SubscriptionUsageRepository {
    async findByScope(
        scopeType: BillingScopeType,
        scopeId: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<ISubscriptionUsageDocument | null> {
        const query = SubscriptionUsageModel.findOne({
            scopeType,
            scopeId: new Types.ObjectId(String(scopeId)),
        });
        if (session) query.session(session);
        return query.exec();
    }

    async upsertUsage(
        scopeType: BillingScopeType,
        scopeId: string | Types.ObjectId,
        data: {
            workspacesUsed: number;
            activeStickyNotesUsed: number;
            storageBytesUsed: number;
            usersUsed: number;
            lastCalculatedAt: Date;
        },
        expectedRevision?: number,
        session?: ClientSession,
    ): Promise<{ usage: ISubscriptionUsageDocument; conflict: boolean }> {
        const objectId = new Types.ObjectId(String(scopeId));

        if (expectedRevision !== undefined) {
            const updated = await SubscriptionUsageModel.findOneAndUpdate(
                {
                    scopeType,
                    scopeId: objectId,
                    revision: expectedRevision,
                },
                {
                    $set: {
                        workspacesUsed: data.workspacesUsed,
                        activeStickyNotesUsed: data.activeStickyNotesUsed,
                        storageBytesUsed: data.storageBytesUsed,
                        usersUsed: data.usersUsed,
                        lastCalculatedAt: data.lastCalculatedAt,
                    },
                    $inc: { revision: 1 },
                },
                {
                    returnDocument: "after",
                    session,
                },
            );

            if (updated) {
                return { usage: updated, conflict: false };
            }

            const current = await this.findByScope(scopeType, objectId, session);
            if (!current) {
                const inserted = await SubscriptionUsageModel.create(
                    [
                        {
                            scopeType,
                            scopeId: objectId,
                            ...data,
                            revision: 1,
                        },
                    ],
                    session ? { session } : undefined,
                );
                return { usage: inserted[0]!, conflict: false };
            }

            return { usage: current, conflict: true };
        }

        const upserted = await SubscriptionUsageModel.findOneAndUpdate(
            {
                scopeType,
                scopeId: objectId,
            },
            {
                $set: {
                    workspacesUsed: data.workspacesUsed,
                    activeStickyNotesUsed: data.activeStickyNotesUsed,
                    storageBytesUsed: data.storageBytesUsed,
                    usersUsed: data.usersUsed,
                    lastCalculatedAt: data.lastCalculatedAt,
                },
                $inc: { revision: 1 },
            },
            {
                returnDocument: "after",
                upsert: true,
                setDefaultsOnInsert: true,
                session,
            },
        );

        return { usage: upserted, conflict: false };
    }

    async countOwnedWorkspaces(ownerId: Types.ObjectId, session?: ClientSession): Promise<number> {
        const query = WorkspaceModel.countDocuments({
            ownerId,
            status: { $in: [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED] },
        });
        if (session) query.session(session);
        return query.exec();
    }

    async findOwnedWorkspaceIds(ownerId: Types.ObjectId, session?: ClientSession): Promise<Types.ObjectId[]> {
        const query = WorkspaceModel.find({
            ownerId,
            status: { $in: [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED] },
        }).select("_id");
        if (session) query.session(session);
        const workspaces = await query.lean().exec();
        return workspaces.map((w) => w._id as Types.ObjectId);
    }

    async countActiveStickyNotes(workspaceIds: Types.ObjectId[], session?: ClientSession): Promise<number> {
        if (!workspaceIds.length) return 0;
        const query = StickyNoteModel.countDocuments({
            workspaceId: { $in: workspaceIds },
            status: StickyNoteStatus.ACTIVE,
        });
        if (session) query.session(session);
        return query.exec();
    }

    async countActiveStickyNotesInWorkspace(
        workspaceId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<number> {
        const query = StickyNoteModel.countDocuments({
            workspaceId,
            status: StickyNoteStatus.ACTIVE,
        });
        if (session) query.session(session);
        return query.exec();
    }

    async countFoldersInWorkspace(workspaceId: Types.ObjectId, session?: ClientSession): Promise<number> {
        const query = WorkspaceFolderModel.countDocuments({
            workspaceId,
            status: { $in: [WorkspaceFolderStatus.ACTIVE, WorkspaceFolderStatus.ARCHIVED] },
        });
        if (session) query.session(session);
        return query.exec();
    }

    async aggregateFoldersByWorkspaceIds(
        workspaceIds: Types.ObjectId[],
        session?: ClientSession,
    ): Promise<Map<string, number>> {
        const map = new Map<string, number>();
        if (!workspaceIds.length) return map;

        const pipeline = [
            {
                $match: {
                    workspaceId: { $in: workspaceIds },
                    status: { $in: [WorkspaceFolderStatus.ACTIVE, WorkspaceFolderStatus.ARCHIVED] },
                },
            },
            {
                $group: {
                    _id: "$workspaceId",
                    foldersUsed: { $sum: 1 },
                },
            },
        ];

        const aggregation = WorkspaceFolderModel.aggregate(pipeline);
        if (session) aggregation.session(session);
        const results = await aggregation.exec();

        for (const row of results) {
            map.set(String(row._id), row.foldersUsed);
        }
        return map;
    }

    async aggregateStorageBytes(
        userId: Types.ObjectId,
        ownedWorkspaceIds: Types.ObjectId[],
        session?: ClientSession,
    ): Promise<number> {
        let noteIds: Types.ObjectId[] = [];
        if (ownedWorkspaceIds.length > 0) {
            const notesQuery = StickyNoteModel.find({ workspaceId: { $in: ownedWorkspaceIds } }).select(
                "_id",
            );
            if (session) notesQuery.session(session);
            const notes = await notesQuery.lean().exec();
            noteIds = notes.map((n) => n._id as Types.ObjectId);
        }

        const resourceOrConditions: Record<string, unknown>[] = [
            { uploadedBy: userId, resourceType: { $in: [MediaResourceType.USER, null] } },
        ];
        if (ownedWorkspaceIds.length > 0) {
            resourceOrConditions.push({
                resourceType: MediaResourceType.WORKSPACE,
                resourceId: { $in: ownedWorkspaceIds },
            });
        }
        if (noteIds.length > 0) {
            resourceOrConditions.push({
                resourceType: MediaResourceType.NOTE,
                resourceId: { $in: noteIds },
            });
        }

        const pipeline = [
            {
                $match: {
                    status: MediaStatus.ACTIVE,
                    storageDeletionPending: { $ne: true },
                    deletedAt: null,
                    $or: resourceOrConditions,
                },
            },
            {
                $group: {
                    _id: null,
                    totalBytes: { $sum: "$size" },
                },
            },
        ];

        const aggregation = MediaModel.aggregate(pipeline);
        if (session) aggregation.session(session);
        const result = await aggregation.exec();

        const raw = result[0]?.totalBytes ?? 0;
        return Math.max(0, typeof raw === "number" && Number.isSafeInteger(raw) ? raw : Math.floor(raw || 0));
    }

    async aggregateWorkspaceStorageBytes(
        workspaceId: Types.ObjectId,
        session?: ClientSession,
    ): Promise<number> {
        const notesQuery = StickyNoteModel.find({ workspaceId }).select("_id");
        if (session) notesQuery.session(session);
        const notes = await notesQuery.lean().exec();
        const noteIds = notes.map((n) => n._id as Types.ObjectId);

        const resourceOrConditions: Record<string, unknown>[] = [
            { resourceType: MediaResourceType.WORKSPACE, resourceId: workspaceId },
        ];
        if (noteIds.length > 0) {
            resourceOrConditions.push({
                resourceType: MediaResourceType.NOTE,
                resourceId: { $in: noteIds },
            });
        }

        const pipeline = [
            {
                $match: {
                    status: MediaStatus.ACTIVE,
                    storageDeletionPending: { $ne: true },
                    deletedAt: null,
                    $or: resourceOrConditions,
                },
            },
            {
                $group: {
                    _id: null,
                    totalBytes: { $sum: "$size" },
                },
            },
        ];

        const aggregation = MediaModel.aggregate(pipeline);
        if (session) aggregation.session(session);
        const result = await aggregation.exec();

        const raw = result[0]?.totalBytes ?? 0;
        return Math.max(0, typeof raw === "number" && Number.isSafeInteger(raw) ? raw : Math.floor(raw || 0));
    }

    async findWorkspaceById(workspaceId: Types.ObjectId, session?: ClientSession) {
        const query = WorkspaceModel.findById(workspaceId);
        if (session) query.session(session);
        return query.lean().exec();
    }

    async findAll(
        filter: ISubscriptionUsageFilter,
        session?: ClientSession,
    ): Promise<{ data: ISubscriptionUsageDocument[]; total: number }> {
        const page = Math.max(1, filter.page ?? SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_PAGE);
        const limit = Math.min(
            SUBSCRIPTION_USAGE_CONSTANTS.MAX_LIMIT,
            Math.max(1, filter.limit ?? SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_LIMIT),
        );
        const skip = (page - 1) * limit;

        const query: Record<string, unknown> = {};
        if (filter.scopeType) {
            query.scopeType = filter.scopeType;
        }
        if (filter.search && Types.ObjectId.isValid(filter.search)) {
            query.scopeId = new Types.ObjectId(filter.search);
        }

        const sortField =
            filter.sortBy && SUBSCRIPTION_USAGE_CONSTANTS.ALLOWED_SORT_FIELDS.includes(filter.sortBy as any)
                ? filter.sortBy
                : SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_SORT_BY;
        const sortDirection = filter.sortOrder === "asc" ? 1 : -1;

        const findQuery = SubscriptionUsageModel.find(query)
            .sort({ [sortField]: sortDirection })
            .skip(skip)
            .limit(limit);
        const countQuery = SubscriptionUsageModel.countDocuments(query);

        if (session) {
            findQuery.session(session);
            countQuery.session(session);
        }

        const [data, total] = await Promise.all([findQuery.exec(), countQuery.exec()]);
        return { data, total };
    }

    async findDistinctScopeIds(limit: number, skip: number): Promise<string[]> {
        const [workspaceOwners, subscribers] = await Promise.all([
            WorkspaceModel.distinct("ownerId"),
            UserSubscriptionModel.distinct("user"),
        ]);
        const set = new Set<string>();
        for (const id of workspaceOwners) {
            if (id) set.add(String(id));
        }
        for (const id of subscribers) {
            if (id) set.add(String(id));
        }
        return Array.from(set).slice(skip, skip + limit);
    }
}
