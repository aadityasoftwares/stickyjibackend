import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserPreferenceModel } from "../../userpreference/models/userPreference.model.js";
import { TimezoneModel } from "../../timezones/models/timezone.model.js";
import mongoose, { Types, type ClientSession, type PipelineStage, type QueryFilter } from "mongoose";
import {
    StickyNoteDateState,
    StickyNoteOverdueSort,
    StickyNoteStatus,
} from "../constants/stickyNote.enums.js";
import { StickyNoteColumnType } from "../../stickynotescolumns/constants/stickyNoteColumn.enums.js";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import type {
    IStickyNote,
    IStickyNoteAssigneeNormalized,
    IStickyNoteChecklistItemResponse,
    IStickyNoteChecklistResponse,
    IStickyNoteChecklistSummary,
    IStickyNoteRepositoryFilter,
    IStickyNoteOverdueFilter,
    IStickyNoteOverdueRecord,
    IStickyNoteOverdueColumnCount,
} from "../interfaces/stickyNote.interface.js";
import { StickyNoteModel } from "../models/stickyNote.model.js";
import { RankUtil } from "../../../utils/rank.util.js";
import { StickyNoteChecklistModel } from "../../stickyNoteschecklist/models/stickyNoteChecklist.model.js";
import { StickyNoteChecklistItemModel } from "../../stickynotechecklistitems/models/stickyNoteChecklistItem.model.js";
import { StickyNoteChecklistStatus } from "../../stickyNoteschecklist/constants/stickyNoteChecklist.enums.js";
import { StickyNoteChecklistItemStatus } from "../../stickynotechecklistitems/constants/stickyNoteChecklistItem.enums.js";
import { StickyNoteAssigneeModel } from "../../stickynotesassignees/models/stickyNoteAssignee.model.js";
import { StickyNoteAssigneeStatus } from "../../stickynotesassignees/constants/stickyNoteAssignee.enums.js";
import { StickyNoteCounterModel } from "../models/stickyNoteCounter.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { StickyNoteColumnModel } from "../../stickynotescolumns/models/stickyNoteColumn.model.js";
import { StickyNoteFavoriteModel } from "../../stickynotesfavorites/models/stickyNoteFavorite.model.js";
import { StickyNoteFavoriteStatus } from "../../stickynotesfavorites/constants/stickyNoteFavorite.enums.js";
import { UserModel } from "../../user/models/user.model.js";
import { normalizeAssignee } from "../utils/stickyNote.mapper.js";

const STICKY_NOTE_SELECT =
    "_id workspaceId workspaceFolderId columnId stickyNoteNumber title content color priority shape variant backgroundPattern position rank status noteDate createdBy updatedBy archivedAt archivedBy deletedAt deletedBy purgeAfter createdAt updatedAt";

export class StickyNoteRepository {
    private overduePipeline(
        workspaceIds: Types.ObjectId[],
        today: string,
        workspaceFolderId?: string,
        ids?: string[],
    ): PipelineStage[] {
        return [
            {
                $match: {
                    workspaceId: { $in: workspaceIds },
                    status: StickyNoteStatus.ACTIVE,
                    noteDate: { $type: "string", $ne: "", $lt: today },
                    ...(workspaceFolderId
                        ? { workspaceFolderId: new Types.ObjectId(workspaceFolderId) }
                        : {}),
                    ...(ids ? { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } } : {}),
                },
            },
            {
                $lookup: {
                    from: StickyNoteColumnModel.collection.name,
                    localField: "columnId",
                    foreignField: "_id",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                name: 1,
                                type: 1,
                                workspaceId: 1,
                                workspaceFolderId: 1,
                            },
                        },
                    ],
                    as: "column",
                },
            },
            { $unwind: "$column" },
            {
                $match: {
                    "column.type": { $ne: StickyNoteColumnType.COMPLETED },
                    $expr: {
                        $and: [
                            { $eq: ["$workspaceId", "$column.workspaceId"] },
                            { $eq: ["$workspaceFolderId", "$column.workspaceFolderId"] },
                        ],
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    workspaceId: 1,
                    workspaceFolderId: 1,
                    columnId: 1,
                    stickyNoteNumber: 1,
                    title: 1,
                    content: 1,
                    noteDate: 1,
                    priority: 1,
                    color: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    "column._id": 1,
                    "column.name": 1,
                    "column.type": 1,
                },
            },
        ];
    }

    async findOverdue(
        workspaceIds: Types.ObjectId[],
        today: string,
        filters: Required<Pick<IStickyNoteOverdueFilter, "page" | "limit" | "sort">> &
            IStickyNoteOverdueFilter,
    ) {
        const direction = filters.sort === StickyNoteOverdueSort.NEWEST_FIRST ? -1 : 1;
        const [result] = await StickyNoteModel.aggregate<{
            notes: IStickyNoteOverdueRecord[];
            byColumn: IStickyNoteOverdueColumnCount[];
        }>([
            ...this.overduePipeline(workspaceIds, today, filters.workspaceFolderId),
            // One facet keeps the page and unpaginated summary on the same query result.
            {
                $facet: {
                    notes: [
                        { $sort: { noteDate: direction, _id: direction } },
                        { $skip: (filters.page - 1) * filters.limit },
                        { $limit: filters.limit },
                    ],
                    byColumn: [
                        {
                            $group: {
                                _id: "$column._id",
                                name: { $first: "$column.name" },
                                type: { $first: "$column.type" },
                                count: { $sum: 1 },
                            },
                        },
                        { $sort: { name: 1, _id: 1 } },
                        {
                            $project: {
                                _id: 0,
                                columnId: { $toString: "$_id" },
                                name: 1,
                                type: 1,
                                count: 1,
                            },
                        },
                    ],
                },
            },
        ]).exec();
        return result ?? { notes: [], byColumn: [] };
    }

    async findOverdueByIds(
        workspaceIds: Types.ObjectId[],
        today: string,
        ids: string[],
        session?: ClientSession,
    ) {
        const query = StickyNoteModel.aggregate<IStickyNoteOverdueRecord>(
            this.overduePipeline(workspaceIds, today, undefined, ids),
        );
        if (session) query.session(session);
        return query.exec();
    }

    async bulkUpdateOverdueNoteDate(
        notes: IStickyNoteOverdueRecord[],
        today: string,
        updatedBy: string,
        session?: ClientSession,
    ) {
        return StickyNoteModel.bulkWrite(
            notes.map((note) => ({
                updateOne: {
                    filter: {
                        _id: note._id,
                        workspaceId: note.workspaceId,
                        workspaceFolderId: note.workspaceFolderId,
                        columnId: note.columnId,
                        status: StickyNoteStatus.ACTIVE,
                        noteDate: note.noteDate,
                    },
                    update: {
                        $set: { noteDate: today, updatedBy: new Types.ObjectId(updatedBy) },
                    },
                },
            })),
            session ? { session } : {},
        );
    }

    async getNextStickyNoteNumber(workspaceId: string | Types.ObjectId): Promise<number> {
        const wsId = typeof workspaceId === "string" ? new Types.ObjectId(workspaceId) : workspaceId;
        const counter = await StickyNoteCounterModel.findOneAndUpdate(
            {
                workspaceId: wsId,
                key: "STICKY_NOTE",
            },
            {
                $inc: { sequence: 1 },
            },
            {
                new: true,
                returnDocument: "after",
                upsert: true,
            },
        )
            .select("sequence")
            .lean()
            .exec();

        if (!counter) throw new Error("Sticky note counter could not be allocated.");
        return counter.sequence;
    }

    async findHierarchy(workspaceId: string, workspaceFolderId: string, columnId: string) {
        return Promise.all([
            WorkspaceModel.findById(workspaceId).select("_id status").lean(),
            WorkspaceFolderModel.findById(workspaceFolderId).select("_id workspaceId status").lean(),
            StickyNoteColumnModel.findById(columnId).select("_id workspaceId workspaceFolderId").lean(),
        ]);
    }

    async findColumnById(columnId: string) {
        return StickyNoteColumnModel.findById(columnId).select("_id workspaceId workspaceFolderId").lean();
    }

    async create(data: Partial<IStickyNote>) {
        return StickyNoteModel.create(data);
    }

    async findById(id: string) {
        return StickyNoteModel.findOne({
            _id: new Types.ObjectId(id),
            status: { $ne: StickyNoteStatus.TRASHED },
        })
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async findByIdRaw(id: string) {
        return StickyNoteModel.findById(new Types.ObjectId(id)).select(STICKY_NOTE_SELECT).lean();
    }

    async findByWorkspaceFolderAndTitle(workspaceId: string, workspaceFolderId: string, title: string) {
        return StickyNoteModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            workspaceFolderId: new Types.ObjectId(workspaceFolderId),
            title,
            status: { $ne: StickyNoteStatus.TRASHED },
        })
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async findByWorkspaceAndNumber(workspaceId: string, stickyNoteNumber: number) {
        return StickyNoteModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            stickyNoteNumber,
            status: { $ne: StickyNoteStatus.TRASHED },
        })
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async findManyPaginated(
        query: QueryFilter<IStickyNote>,
        sort: Record<string, 1 | -1>,
        skip: number,
        limit: number,
    ) {
        const [data, total] = await Promise.all([
            StickyNoteModel.find(query).select(STICKY_NOTE_SELECT).sort(sort).skip(skip).limit(limit).lean(),
            StickyNoteModel.countDocuments(query),
        ]);
        return { data, total };
    }

    async findAll(filters: IStickyNoteRepositoryFilter = {}) {
        const {
            workspaceId,
            workspaceFolderId,
            columnId,
            search,
            color,
            priority,
            shape,
            variant,
            status,
            createdBy,
            noteDate,
            noteDateFrom,
            noteDateTo,
            noteDateState,
            sortBy = "createdAt",
            sortOrder = "desc",
            page = 1,
            limit = 20,
        } = filters;

        const query: QueryFilter<IStickyNote> = {};
        if (workspaceId) query.workspaceId = new Types.ObjectId(workspaceId);
        if (workspaceFolderId) query.workspaceFolderId = new Types.ObjectId(workspaceFolderId);
        if (columnId) query.columnId = new Types.ObjectId(columnId);
        if (filters.stickyNoteNumber !== undefined) query.stickyNoteNumber = filters.stickyNoteNumber;

        if (search) {
            const stMatch = search.trim().match(/^ST-(\d+)$/i);
            if (stMatch) {
                query.stickyNoteNumber = Number(stMatch[1]);
            } else {
                query.$text = { $search: search };
            }
        }

        if (color) query.color = color;
        if (priority) query.priority = priority;
        if (shape) query.shape = shape;
        if (variant) query.variant = variant;

        if (status) {
            query.status = status;
        } else {
            query.status = { $ne: StickyNoteStatus.TRASHED };
        }

        if (createdBy) query.createdBy = new Types.ObjectId(createdBy);

        if (noteDate !== undefined) {
            query.noteDate = noteDate;
        } else if (noteDateState === StickyNoteDateState.UNSCHEDULED) {
            query.noteDate = null;
        } else if (noteDateFrom || noteDateTo) {
            const dateCondition: Record<string, string> = {};
            if (noteDateFrom) dateCondition.$gte = noteDateFrom;
            if (noteDateTo) dateCondition.$lte = noteDateTo;
            query.noteDate = dateCondition;
        }

        if (noteDateState === StickyNoteDateState.SCHEDULED) {
            query.noteDate =
                noteDate !== undefined
                    ? noteDate
                    : {
                          $type: "string",
                          $ne: "",
                          ...(noteDateFrom ? { $gte: noteDateFrom } : {}),
                          ...(noteDateTo ? { $lte: noteDateTo } : {}),
                      };
        }

        if (!workspaceId) {
            query.$and = [
                ...(query.$and ?? []),
                {
                    workspaceId: {
                        $nin: await new WorkspaceRepository().findUnavailableIds(),
                    },
                },
            ];
        }

        const skip = (page - 1) * limit;
        const sortDirection = sortOrder === "asc" ? 1 : -1;
        let sort: Record<string, 1 | -1> = { [sortBy]: sortDirection };

        if (sortBy === "position") {
            sort = {
                rank: sortDirection,
                position: sortDirection,
                createdAt: sortDirection,
            };
        }

        const { data, total } = await this.findManyPaginated(query, sort, skip, limit);

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

    /* Helper Methods for Efficient Relation Resolution */

    async findFolderNamesMap(folderIds: string[]): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (folderIds.length === 0) return map;

        const validIds = folderIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (validIds.length === 0) return map;

        const folders = await WorkspaceFolderModel.find({ _id: { $in: validIds } })
            .select("_id name")
            .lean();
        for (const folder of folders) {
            map.set(folder._id.toString(), folder.name);
        }
        return map;
    }

    async findFavoritesMap(noteIds: string[], userId: string): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (noteIds.length === 0 || !Types.ObjectId.isValid(userId)) return map;

        const validNoteIds = noteIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (validNoteIds.length === 0) return map;

        const favorites = await StickyNoteFavoriteModel.find({
            stickyNoteId: { $in: validNoteIds },
            userId: new Types.ObjectId(userId),
            status: StickyNoteFavoriteStatus.ACTIVE,
        })
            .select("_id stickyNoteId")
            .lean();

        for (const fav of favorites) {
            map.set(fav.stickyNoteId.toString(), fav._id.toString());
        }
        return map;
    }

    async findCreatorEmailsMap(userIds: string[]): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (userIds.length === 0) return map;

        const validIds = userIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (validIds.length === 0) return map;

        const users = await UserModel.find({ _id: { $in: validIds } })
            .select("_id email")
            .lean();
        for (const u of users) {
            map.set(u._id.toString(), u.email);
        }
        return map;
    }

    async findAssigneesMap(noteIds: string[]): Promise<Map<string, IStickyNoteAssigneeNormalized[]>> {
        const map = new Map<string, IStickyNoteAssigneeNormalized[]>();
        if (noteIds.length === 0) return map;

        const validNoteIds = noteIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (validNoteIds.length === 0) return map;

        const assignees = await StickyNoteAssigneeModel.find({
            stickyNoteId: { $in: validNoteIds },
            status: StickyNoteAssigneeStatus.ACTIVE,
        })
            .populate({
                path: "userId",
                select: "_id firstName lastName displayName email avatarUrl avatar",
            })
            .sort({ assignedAt: 1, createdAt: 1 })
            .lean();

        for (const assignee of assignees) {
            const key = assignee.stickyNoteId.toString();
            const list = map.get(key) ?? [];
            list.push(normalizeAssignee(assignee.userId));
            map.set(key, list);
        }
        return map;
    }

    async findChecklistsMap(noteIds: string[]): Promise<Map<string, IStickyNoteChecklistResponse[]>> {
        const map = new Map<string, IStickyNoteChecklistResponse[]>();
        if (noteIds.length === 0) return map;

        const validNoteIds = noteIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (validNoteIds.length === 0) return map;

        const checklists = await StickyNoteChecklistModel.find({
            stickyNoteId: { $in: validNoteIds },
            status: StickyNoteChecklistStatus.ACTIVE,
        })
            .select("_id stickyNoteId title position status")
            .sort({ stickyNoteId: 1, position: 1, createdAt: 1 })
            .lean();

        if (checklists.length === 0) return map;

        const checklistIds = checklists.map((c) => c._id);
        const items = await StickyNoteChecklistItemModel.find({
            checklistId: { $in: checklistIds },
            status: StickyNoteChecklistItemStatus.ACTIVE,
        })
            .select("_id checklistId title position isCompleted status")
            .sort({ checklistId: 1, position: 1, createdAt: 1 })
            .lean();

        const itemsByChecklist = new Map<string, IStickyNoteChecklistItemResponse[]>();
        for (const item of items) {
            const cId = item.checklistId.toString();
            const list = itemsByChecklist.get(cId) ?? [];
            list.push({
                id: item._id.toString(),
                _id: item._id.toString(),
                checklistId: cId,
                title: item.title ?? "",
                position: item.position ?? 0,
                isCompleted: Boolean(item.isCompleted),
                status: item.status ?? "ACTIVE",
            });
            itemsByChecklist.set(cId, list);
        }

        for (const cl of checklists) {
            const noteId = cl.stickyNoteId.toString();
            const list = map.get(noteId) ?? [];
            const clId = cl._id.toString();
            list.push({
                id: clId,
                _id: clId,
                stickyNoteId: noteId,
                title: cl.title ?? "",
                position: cl.position ?? 0,
                status: cl.status ?? "ACTIVE",
                items: itemsByChecklist.get(clId) ?? [],
            });
            map.set(noteId, list);
        }

        return map;
    }

    async findSingleFolderName(folderId: string | Types.ObjectId | null | undefined): Promise<string | null> {
        if (!folderId || !Types.ObjectId.isValid(folderId.toString())) return null;
        const folder = await WorkspaceFolderModel.findById(folderId).select("name").lean();
        return folder?.name ?? null;
    }

    async findSingleFavorite(
        noteId: string | Types.ObjectId,
        userId: string,
    ): Promise<{ isFavorite: boolean; favoriteId: string | null }> {
        if (!Types.ObjectId.isValid(noteId.toString()) || !Types.ObjectId.isValid(userId)) {
            return { isFavorite: false, favoriteId: null };
        }
        const fav = await StickyNoteFavoriteModel.findOne({
            stickyNoteId: new Types.ObjectId(noteId.toString()),
            userId: new Types.ObjectId(userId),
            status: StickyNoteFavoriteStatus.ACTIVE,
        })
            .select("_id")
            .lean();

        return fav
            ? { isFavorite: true, favoriteId: fav._id.toString() }
            : { isFavorite: false, favoriteId: null };
    }

    async findSingleAssignees(noteId: string | Types.ObjectId): Promise<IStickyNoteAssigneeNormalized[]> {
        if (!Types.ObjectId.isValid(noteId.toString())) return [];
        const assignees = await StickyNoteAssigneeModel.find({
            stickyNoteId: new Types.ObjectId(noteId.toString()),
            status: StickyNoteAssigneeStatus.ACTIVE,
        })
            .populate({
                path: "userId",
                select: "_id firstName lastName displayName email avatarUrl avatar",
            })
            .sort({ assignedAt: 1, createdAt: 1 })
            .lean();

        return assignees.map((a) => normalizeAssignee(a.userId));
    }

    async findSingleChecklists(noteId: string | Types.ObjectId): Promise<IStickyNoteChecklistResponse[]> {
        if (!Types.ObjectId.isValid(noteId.toString())) return [];
        const map = await this.findChecklistsMap([noteId.toString()]);
        return map.get(noteId.toString()) ?? [];
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await StickyNoteModel.exists({
            _id: new Types.ObjectId(id),
            status: { $ne: StickyNoteStatus.TRASHED },
        });
        return Boolean(exists);
    }

    async updateById(id: string, data: Partial<IStickyNote>) {
        return StickyNoteModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                status: { $ne: StickyNoteStatus.TRASHED },
            },
            { $set: data },
            { new: true, runValidators: true },
        )
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async updateStatus(id: string, status: StickyNoteStatus, updatedBy?: Types.ObjectId) {
        const now = new Date();
        const updateData: Partial<IStickyNote> = {
            status,
            ...(updatedBy ? { updatedBy } : {}),
        };

        if (status === StickyNoteStatus.TRASHED) {
            updateData.deletedAt = now;
            updateData.deletedBy = updatedBy ?? null;
            updateData.purgeAfter = new Date(
                now.getTime() + STICKY_NOTE_CONSTANTS.TRASH.RETENTION_DAYS * 24 * 60 * 60 * 1000,
            );
        } else if (status === StickyNoteStatus.ARCHIVED) {
            updateData.archivedAt = now;
            updateData.archivedBy = updatedBy ?? null;
        } else if (status === StickyNoteStatus.ACTIVE) {
            updateData.archivedAt = null;
            updateData.archivedBy = null;
            updateData.deletedAt = null;
            updateData.deletedBy = null;
            updateData.purgeAfter = null;
        }

        return StickyNoteModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: updateData },
            { new: true, runValidators: true },
        )
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async softDelete(id: string, updatedBy?: Types.ObjectId) {
        return this.updateStatus(id, StickyNoteStatus.TRASHED, updatedBy);
    }

    async restore(id: string, updatedBy?: Types.ObjectId) {
        return this.updateStatus(id, StickyNoteStatus.ACTIVE, updatedBy);
    }

    async updateRank(id: string, rank: string, updatedBy: Types.ObjectId) {
        return StickyNoteModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: { rank, updatedBy } },
            { new: true, runValidators: true },
        )
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async moveToColumnAndRank(
        id: string,
        columnId: string,
        rank: string,
        workspaceFolderId: string | null,
        updatedBy: Types.ObjectId,
    ) {
        const updateData: Partial<IStickyNote> = {
            columnId: new Types.ObjectId(columnId),
            rank,
            updatedBy,
            workspaceFolderId: workspaceFolderId ? new Types.ObjectId(workspaceFolderId) : null,
        };
        return StickyNoteModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: updateData },
            { new: true, runValidators: true },
        )
            .select(STICKY_NOTE_SELECT)
            .lean();
    }

    async getHighestPositionByColumn(columnId: string): Promise<number> {
        const note = await StickyNoteModel.findOne({
            columnId: new Types.ObjectId(columnId),
            status: StickyNoteStatus.ACTIVE,
        })
            .sort({ position: -1 })
            .select("position")
            .lean();
        return note?.position ?? -1;
    }

    async getHighestRankByColumn(columnId: string, excludeId?: string): Promise<string | null> {
        const query: QueryFilter<IStickyNote> = {
            columnId: new Types.ObjectId(columnId),
            status: StickyNoteStatus.ACTIVE,
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const note = await StickyNoteModel.findOne(query)
            .sort({ rank: -1, position: -1 })
            .select("rank")
            .lean();
        return note?.rank ?? null;
    }

    async findAdjacentRank(
        columnId: string,
        referenceRank: string,
        direction: "before" | "after",
        excludeIds: readonly string[],
    ): Promise<string | null> {
        const isAfter = direction === "after";
        const note = await StickyNoteModel.findOne({
            columnId: new Types.ObjectId(columnId),
            _id: { $nin: excludeIds.map((id) => new Types.ObjectId(id)) },
            status: StickyNoteStatus.ACTIVE,
            rank: isAfter ? { $gt: referenceRank } : { $lt: referenceRank },
        })
            .sort({ rank: isAfter ? 1 : -1, position: isAfter ? 1 : -1 })
            .select("rank")
            .lean();
        return note?.rank ?? null;
    }

    async getNextPositionByColumn(columnId: string): Promise<number> {
        const highest = await this.getHighestPositionByColumn(columnId);
        return highest + 1;
    }

    async getNextRankByColumn(columnId: string): Promise<string> {
        const highestRank = await this.getHighestRankByColumn(columnId);
        if (!highestRank) return RankUtil.generateInitialRank();
        return RankUtil.generateRankAfter(highestRank) ?? RankUtil.generateInitialRank();
    }

    async moveAllFromColumn(
        sourceColumnId: string,
        targetColumnId: string,
        updatedBy: Types.ObjectId,
        session?: ClientSession,
    ) {
        const query = StickyNoteModel.updateMany(
            { columnId: new Types.ObjectId(sourceColumnId) },
            { $set: { columnId: new Types.ObjectId(targetColumnId), updatedBy } },
        );
        if (session) query.session(session);
        return query.exec();
    }

    async normalizeRanks(columnId: string): Promise<void> {
        const notes = await StickyNoteModel.find({
            columnId: new Types.ObjectId(columnId),
            status: StickyNoteStatus.ACTIVE,
        })
            .select("_id rank position createdAt")
            .sort({ rank: 1, position: 1, createdAt: 1, _id: 1 })
            .lean();

        if (notes.length === 0) return;
        const newRanks = RankUtil.generateNSequentialRanks(notes.length);
        const bulkOps = notes.map((note, index) => ({
            updateOne: {
                filter: { _id: note._id },
                update: { $set: { rank: newRanks[index], position: index + 1 } },
            },
        }));
        await StickyNoteModel.bulkWrite(bulkOps);
    }

    async syncColumnPositions(columnId: string): Promise<void> {
        const notes = await StickyNoteModel.find({
            columnId: new Types.ObjectId(columnId),
            status: StickyNoteStatus.ACTIVE,
        })
            .sort({ rank: 1, createdAt: 1, _id: 1 })
            .select("_id position")
            .lean();

        const operations = notes
            .map((note, index) => ({ note, targetPosition: index + 1 }))
            .filter(({ note, targetPosition }) => note.position !== targetPosition)
            .map(({ note, targetPosition }) => ({
                updateOne: {
                    filter: { _id: note._id },
                    update: { $set: { position: targetPosition } },
                },
            }));

        if (operations.length > 0) {
            await StickyNoteModel.bulkWrite(operations);
        }
    }

    async findExpiredTrashedIds(
        now = new Date(),
        limit = STICKY_NOTE_CONSTANTS.TRASH.PURGE_BATCH_SIZE,
    ): Promise<string[]> {
        const stickyNotes = await StickyNoteModel.find({
            status: StickyNoteStatus.TRASHED,
            purgeAfter: { $ne: null, $lte: now },
        })
            .sort({ purgeAfter: 1, _id: 1 })
            .limit(limit)
            .select("_id")
            .lean();
        return stickyNotes.map((n) => n._id.toString());
    }

    async findTimeZonePreference(userId: string) {
        return UserPreferenceModel.findOne({
            userId: new Types.ObjectId(userId),
            key: { $in: [...STICKY_NOTE_CONSTANTS.TIMEZONE.PREFERENCE_KEYS] },
        })
            .select({ value: 1 })
            .lean()
            .exec();
    }

    async findDefaultTimeZone() {
        return TimezoneModel.findOne({ isActive: true, isDefault: true })
            .select({ code: 1, name: 1 })
            .lean()
            .exec();
    }

    async findTimeZone(candidate: string) {
        return TimezoneModel.findOne({
            isActive: true,
            ...(Types.ObjectId.isValid(candidate)
                ? { _id: new Types.ObjectId(candidate) }
                : { $or: [{ code: candidate }, { name: candidate }] }),
        })
            .select({ code: 1, name: 1 })
            .lean()
            .exec();
    }

    async runInTransaction<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
        return this.runInTransactionIfSupported(operation);
    }

    async runInTransactionIfSupported<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
        const database = mongoose.connection.db;
        if (!database) throw new Error("MongoDB is not connected.");

        try {
            const hello = (await database.admin().command({ hello: 1 })) as {
                setName?: string;
                msg?: string;
            };
            const supportsTransactions = Boolean(hello.setName) || hello.msg === "isdbgrid";

            if (!supportsTransactions) return operation();

            const session = await mongoose.startSession();
            try {
                const result = await session.withTransaction(() => operation(session));
                if (result === undefined) throw new Error("Sticky note transaction did not complete.");
                return result;
            } finally {
                await session.endSession();
            }
        } catch (error: any) {
            if (
                error?.code === 20 ||
                error?.codeName === "IllegalOperation" ||
                (typeof error?.message === "string" &&
                    error.message.includes("Transaction numbers are only allowed"))
            ) {
                return operation();
            }
            throw error;
        }
    }

    async findPurgeCandidate(id: string, session?: ClientSession) {
        const query = StickyNoteModel.findById(id).select("_id status");
        if (session) query.session(session);
        return query.lean().exec();
    }

    async deleteDependentData(id: string, session?: ClientSession) {
        const stickyNoteId = new Types.ObjectId(id);
        const checklistsQuery = StickyNoteChecklistModel.find({
            stickyNoteId,
        }).select("_id");
        if (session) checklistsQuery.session(session);
        const checklists = await checklistsQuery.lean().exec();

        let deletedChecklistItems = 0;
        if (checklists.length > 0) {
            const itemsQuery = StickyNoteChecklistItemModel.deleteMany({
                checklistId: { $in: checklists.map((checklist) => checklist._id) },
            });
            if (session) itemsQuery.session(session);
            const items = await itemsQuery.exec();
            deletedChecklistItems = items.deletedCount;
        }

        const deletedChecklistsQuery = StickyNoteChecklistModel.deleteMany({
            stickyNoteId,
        });
        if (session) deletedChecklistsQuery.session(session);
        const deletedChecklists = await deletedChecklistsQuery.exec();

        const assigneeQuery = StickyNoteAssigneeModel.deleteMany({ stickyNoteId });
        if (session) assigneeQuery.session(session);
        await assigneeQuery.exec();

        const deletedNoteQuery = StickyNoteModel.deleteOne({
            _id: stickyNoteId,
            status: StickyNoteStatus.TRASHED,
        });
        if (session) deletedNoteQuery.session(session);
        const deletedNote = await deletedNoteQuery.exec();

        return {
            stickyNoteId: id,
            deletedChecklistItems,
            deletedChecklists: deletedChecklists.deletedCount,
            deletedStickyNotes: deletedNote.deletedCount,
        };
    }

    async getStickyNoteCountsByFolderIds(folderIds: string[]) {
        if (!folderIds.length) return new Map();
        const ids = folderIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
        if (!ids.length) return new Map();

        const summaries = new Map<
            string,
            {
                stickyNoteCount: number;
                stickyNotesCount: number;
                total: number;
                active: number;
                archived: number;
            }
        >();

        for (const id of ids) {
            summaries.set(id.toString(), {
                stickyNoteCount: 0,
                stickyNotesCount: 0,
                total: 0,
                active: 0,
                archived: 0,
            });
        }

        const rows = await StickyNoteModel.aggregate<{
            _id: { folderId: Types.ObjectId; status: StickyNoteStatus };
            count: number;
        }>([
            {
                $match: {
                    workspaceFolderId: { $in: ids },
                    status: { $in: [StickyNoteStatus.ACTIVE, StickyNoteStatus.ARCHIVED] },
                },
            },
            {
                $group: {
                    _id: { folderId: "$workspaceFolderId", status: "$status" },
                    count: { $sum: 1 },
                },
            },
        ]).exec();

        for (const row of rows) {
            const folderId = row._id.folderId.toString();
            const summary = summaries.get(folderId);
            if (!summary) continue;

            if (row._id.status === StickyNoteStatus.ACTIVE) {
                summary.active = row.count;
                summary.stickyNoteCount = row.count;
                summary.stickyNotesCount = row.count;
            } else if (row._id.status === StickyNoteStatus.ARCHIVED) {
                summary.archived = row.count;
            }
            summary.total = summary.active + summary.archived;
        }

        return summaries;
    }
}
