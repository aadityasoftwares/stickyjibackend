import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import mongoose, { Types, type ClientSession } from "mongoose";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceStatus } from "../../workspace/constants/workspace.enums.js";
import { PermissionModule } from "../../permissions/constants/permission.enums.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";
import { StickyNoteStatus } from "../../stickynotes/constants/stickyNote.enums.js";
import { StickyNoteColumnModel } from "../../stickynotescolumns/models/stickyNoteColumn.model.js";
import { MediaModel } from "../../media/models/media.model.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";
import type { QueryFilter } from "mongoose";
import { WorkspaceFolderModel } from "../models/workspaceFolder.model.js";
import type {
    IWorkspaceFolder,
    IWorkspaceFolderFilter,
    IWorkspaceFolderSummary,
} from "../interfaces/workspaceFolder.interface.js";
import { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";
import { WORKSPACE_FOLDER_CONSTANTS } from "../constants/workspaceFolder.constants.js";

const WORKSPACE_FOLDER_SELECT = {
    _id: 1,
    workspaceId: 1,
    name: 1,
    slug: 1,
    description: 1,
    icon: 1,
    color: 1,
    position: 1,
    isDefault: 1,
    status: 1,
    createdBy: 1,
    updatedBy: 1,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 1,
    deletedBy: 1,
    purgeAfter: 1,
} as const;

export class WorkspaceFolderRepository {
    async findReadableWorkspaceIds(userId: string) {
        const memberships = await new WorkspaceRepository().findReadableMemberships(
            userId,
            PermissionModule.FOLDERS,
        );
        const workspaces = await WorkspaceModel.find({
            status: { $in: [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED] },
            $or: [
                { ownerId: new Types.ObjectId(userId) },
                { _id: { $in: memberships.map((m) => m.workspaceId) } },
            ],
        })
            .select("_id")
            .lean()
            .exec();
        return workspaces.map((workspace) => workspace._id.toString());
    }

    async runInTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
        return mongoose.connection.transaction(operation);
    }

    async hasDependencies(id: string, session: ClientSession): Promise<boolean> {
        const folderId = new Types.ObjectId(id);
        // Include inconsistent cross-workspace references: never leave dangling children.
        if (await StickyNoteModel.exists({ workspaceFolderId: folderId }).session(session)) return true;
        if (await StickyNoteColumnModel.exists({ workspaceFolderId: folderId }).session(session)) return true;
        return Boolean(await MediaModel.exists({ resourceId: id }).session(session));
    }

    async deleteTrashed(id: string, workspaceId: string, session: ClientSession) {
        return WorkspaceFolderModel.deleteOne({
            _id: new Types.ObjectId(id),
            workspaceId: new Types.ObjectId(workspaceId),
            status: WorkspaceFolderStatus.DELETED,
            isDefault: false,
        })
            .session(session)
            .exec();
    }
    async create(data: Partial<IWorkspaceFolder>) {
        return WorkspaceFolderModel.create(data);
    }

    async findById(id: string) {
        return WorkspaceFolderModel.findOne({
            _id: new Types.ObjectId(id),
            status: { $ne: WorkspaceFolderStatus.DELETED },
        })
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async findByIdIncludingDeleted(id: string) {
        return WorkspaceFolderModel.findById(new Types.ObjectId(id))
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async findByWorkspaceAndSlug(workspaceId: string, slug: string) {
        return WorkspaceFolderModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            slug: slug.toLowerCase().trim(),
        })
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async findDefaultFolder(workspaceId: string) {
        return WorkspaceFolderModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            isDefault: true,
            status: { $ne: WorkspaceFolderStatus.DELETED },
        })
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async getHighestPosition(workspaceId: string): Promise<number> {
        const folder = await WorkspaceFolderModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            status: { $ne: WorkspaceFolderStatus.DELETED },
        })
            .sort({ position: -1, _id: -1 })
            .select({ position: 1 })
            .lean()
            .exec();

        return folder?.position ?? -1;
    }

    async findAll(filters: IWorkspaceFolderFilter = {}) {
        const {
            page = WORKSPACE_FOLDER_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_FOLDER_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            sortBy = WORKSPACE_FOLDER_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder = WORKSPACE_FOLDER_CONSTANTS.DEFAULT_SORT_ORDER,
        } = filters;

        const query = this.buildFilterQuery(filters);
        const skip = (page - 1) * limit;
        const direction = sortOrder === "asc" ? 1 : -1;

        const [data, total] = await Promise.all([
            WorkspaceFolderModel.find(query)
                .select(WORKSPACE_FOLDER_SELECT)
                .sort({ [sortBy]: direction, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            WorkspaceFolderModel.countDocuments(query).exec(),
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

    async findAccessibleByUser(accessibleWorkspaceIds: string[], filters: IWorkspaceFolderFilter = {}) {
        const {
            page = WORKSPACE_FOLDER_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_FOLDER_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            sortBy = WORKSPACE_FOLDER_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder = WORKSPACE_FOLDER_CONSTANTS.DEFAULT_SORT_ORDER,
        } = filters;

        const query = this.buildFilterQuery(filters);

        const workspaceObjectIds = accessibleWorkspaceIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        query.$and = [...(query.$and ?? []), { workspaceId: { $in: workspaceObjectIds } }];

        const { skip } = getPagination(page, limit);
        const direction = sortOrder === "asc" ? 1 : -1;

        const status = query.status;
        delete query.status;
        const selected = { $match: { status } };
        const [result] = await WorkspaceFolderModel.aggregate<{
            data: Array<IWorkspaceFolder & { _id: Types.ObjectId }>;
            total: Array<{ count: number }>;
            counts: Array<{ _id: WorkspaceFolderStatus; count: number }>;
        }>([
            { $match: query },
            {
                $facet: {
                    data: [
                        selected,
                        {
                            $sort: {
                                ...(filters.workspaceId ? {} : { isDefault: -1 as const }),
                                [sortBy]: direction,
                                _id: 1,
                            },
                        },
                        { $skip: skip },
                        { $limit: limit },
                        { $project: WORKSPACE_FOLDER_SELECT },
                    ],
                    total: [selected, { $count: "count" }],
                    counts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                },
            },
        ]).exec();
        const counts = { all: 0, active: 0, inactive: 0, archived: 0, deleted: 0 };
        for (const row of result?.counts ?? []) {
            if (row._id === WorkspaceFolderStatus.ACTIVE) counts.active = row.count;
            if (row._id === WorkspaceFolderStatus.INACTIVE) counts.inactive = row.count;
            if (row._id === WorkspaceFolderStatus.ARCHIVED) counts.archived = row.count;
            if (row._id === WorkspaceFolderStatus.DELETED) counts.deleted = row.count;
        }
        counts.all = counts.active + counts.inactive + counts.archived;
        return {
            data: result?.data ?? [],
            pagination: paginationMeta(page, limit, result?.total[0]?.count ?? 0),
            counts,
        };
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await WorkspaceFolderModel.exists({ _id: new Types.ObjectId(id) });
        return !!exists;
    }

    async existsBySlug(workspaceId: string, slug: string): Promise<boolean> {
        const exists = await WorkspaceFolderModel.exists({
            workspaceId: new Types.ObjectId(workspaceId),
            slug: slug.toLowerCase().trim(),
        });
        return !!exists;
    }

    async existsDefaultFolder(workspaceId: string, excludeId?: string): Promise<boolean> {
        const query: QueryFilter<IWorkspaceFolder> = {
            workspaceId: new Types.ObjectId(workspaceId),
            isDefault: true,
            status: { $ne: WorkspaceFolderStatus.DELETED },
        };

        if (excludeId) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }

        const exists = await WorkspaceFolderModel.exists(query);
        return !!exists;
    }

    async updateById(id: string, data: Partial<IWorkspaceFolder>) {
        return WorkspaceFolderModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), status: { $ne: WorkspaceFolderStatus.DELETED } },
            { $set: data },
            { new: true, runValidators: true },
        )
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async updateStatus(id: string, status: WorkspaceFolderStatus, updatedBy?: IWorkspaceFolder["updatedBy"]) {
        return WorkspaceFolderModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), status: { $ne: WorkspaceFolderStatus.DELETED } },
            {
                $set: {
                    status,
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
                },
            },
            { new: true, runValidators: true },
        )
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async softDelete(id: string, updatedBy?: IWorkspaceFolder["updatedBy"]) {
        const now = new Date();
        return WorkspaceFolderModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                status: { $ne: WorkspaceFolderStatus.DELETED },
                isDefault: false,
            },
            {
                $set: {
                    status: WorkspaceFolderStatus.DELETED,
                    deletedAt: now,
                    deletedBy: updatedBy ?? null,
                    purgeAfter: new Date(
                        now.getTime() + WORKSPACE_FOLDER_CONSTANTS.TRASH.RETENTION_DAYS * 86400000,
                    ),
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
                },
            },
            { new: true, runValidators: true },
        )
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async restore(id: string, updatedBy?: IWorkspaceFolder["updatedBy"]) {
        return WorkspaceFolderModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                status: WorkspaceFolderStatus.DELETED,
                isDefault: false,
                $or: [{ purgeAfter: null }, { purgeAfter: { $gt: new Date() } }],
            },
            {
                $set: {
                    status: WorkspaceFolderStatus.ACTIVE,
                    deletedAt: null,
                    deletedBy: null,
                    purgeAfter: null,
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
                },
            },
            { new: true, runValidators: true },
        )
            .select(WORKSPACE_FOLDER_SELECT)
            .lean()
            .exec();
    }

    async hardDeleteById(id: string) {
        return WorkspaceFolderModel.findByIdAndDelete(new Types.ObjectId(id)).exec();
    }

    async rollbackById(id: string, data: Record<string, unknown>) {
        return WorkspaceFolderModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: data },
            { new: true, runValidators: false, timestamps: false },
        ).exec();
    }

    async getActiveFolderCountsByWorkspaceIds(workspaceIds: string[]): Promise<Map<string, number>> {
        if (!workspaceIds.length) {
            return new Map();
        }

        const ids = workspaceIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (!ids.length) {
            return new Map();
        }

        const rows = await WorkspaceFolderModel.aggregate<{
            _id: Types.ObjectId;
            count: number;
        }>([
            {
                $match: {
                    workspaceId: { $in: ids },
                    status: WorkspaceFolderStatus.ACTIVE,
                },
            },
            {
                $group: {
                    _id: "$workspaceId",
                    count: { $sum: 1 },
                },
            },
        ]).exec();

        return new Map(rows.map((row) => [row._id.toString(), row.count]));
    }

    async getActiveFolderSummariesByWorkspaceIds(
        workspaceIds: string[],
    ): Promise<Map<string, Array<{ id: string; name: string }>>> {
        if (!workspaceIds.length) {
            return new Map();
        }

        const ids = workspaceIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (!ids.length) {
            return new Map();
        }

        const folders = await WorkspaceFolderModel.find({
            workspaceId: { $in: ids },
            status: WorkspaceFolderStatus.ACTIVE,
        })
            .select({ _id: 1, workspaceId: 1, name: 1 })
            .sort({ workspaceId: 1, isDefault: -1, position: 1, name: 1, _id: 1 })
            .lean()
            .exec();

        const summaries = new Map<string, Array<{ id: string; name: string }>>();

        for (const folder of folders) {
            const workspaceId = folder.workspaceId.toString();
            const workspaceFolders = summaries.get(workspaceId) ?? [];
            workspaceFolders.push({ id: folder._id.toString(), name: folder.name });
            summaries.set(workspaceId, workspaceFolders);
        }

        return summaries;
    }

    async getStickyNoteCountsByFolderIds(folderIds: string[]): Promise<Map<string, IWorkspaceFolderSummary>> {
        if (!folderIds.length) {
            return new Map();
        }

        const ids = folderIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));

        if (!ids.length) {
            return new Map();
        }

        const summaries = new Map<string, IWorkspaceFolderSummary>();

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
                    _id: {
                        folderId: "$workspaceFolderId",
                        status: "$status",
                    },
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

    async getActiveStickyNoteCountsByFolderIds(
        folderIds: string[],
    ): Promise<Map<string, IWorkspaceFolderSummary>> {
        return this.getStickyNoteCountsByFolderIds(folderIds);
    }

    private buildFilterQuery(filters: IWorkspaceFolderFilter): QueryFilter<IWorkspaceFolder> {
        const query: QueryFilter<IWorkspaceFolder> = {};

        if (filters.workspaceId) {
            query.workspaceId =
                typeof filters.workspaceId === "string"
                    ? new Types.ObjectId(filters.workspaceId)
                    : filters.workspaceId;
        }

        const search = filters.search?.trim();

        if (search) {
            const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$and = [
                {
                    $or: [
                        { name: { $regex: escapedSearch, $options: "i" } },
                        { slug: { $regex: escapedSearch, $options: "i" } },
                        { description: { $regex: escapedSearch, $options: "i" } },
                    ],
                },
            ];
        }

        query.status =
            filters.status && filters.status !== "ALL"
                ? filters.status
                : { $ne: WorkspaceFolderStatus.DELETED };

        if (filters.isDefault !== undefined) {
            query.isDefault = filters.isDefault;
        }

        if (filters.createdBy) {
            query.createdBy =
                typeof filters.createdBy === "string"
                    ? new Types.ObjectId(filters.createdBy)
                    : filters.createdBy;
        }

        return query;
    }
}
