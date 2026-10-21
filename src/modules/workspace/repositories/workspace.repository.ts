import mongoose, { Types } from "mongoose";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { StickyNoteCounterModel } from "../../stickynotes/models/stickyNoteCounter.model.js";
import { StickyNoteChecklistModel } from "../../stickyNoteschecklist/models/stickyNoteChecklist.model.js";
import { StickyNoteChecklistItemModel } from "../../stickynotechecklistitems/models/stickyNoteChecklistItem.model.js";
import { StickyNoteAssigneeModel } from "../../stickynotesassignees/models/stickyNoteAssignee.model.js";
import { StickyNoteFavoriteModel } from "../../stickynotesfavorites/models/stickyNoteFavorite.model.js";
import { StickyNoteColumnModel } from "../../stickynotescolumns/models/stickyNoteColumn.model.js";
import { StickyNoteLabelModel } from "../../stickynotelabels/models/stickyNoteLabel.model.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { WorkspaceMemberInvitationModel } from "../../workspaceInvitations/models/workspaceMemberInvitation.model.js";
import { RoleModel } from "../../roles/models/role.model.js";
import { MediaModel } from "../../media/models/media.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { PermissionModel } from "../../permissions/models/permission.model.js";
import {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} from "../../permissions/constants/permission.enums.js";
import { RoleScope } from "../../roles/constants/role.enums.js";
import { SYSTEM_ROLE_CODES } from "../../roles/constants/role.constants.js";
import { MediaResourceType, MediaStatus } from "../../media/constants/media.enums.js";
import type { ClientSession, QueryFilter, PipelineStage } from "mongoose";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";
import { WorkspaceModel } from "../models/workspace.model.js";
import type { IWorkspace, IWorkspaceFilter } from "../interfaces/workspace.interface.js";
import {
    WorkspaceAccessFilter,
    WorkspaceStatus,
    WORKSPACE_TRASH_STATUSES,
    isWorkspaceTrashed,
} from "../constants/workspace.enums.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";
import type { WorkspaceListRecord, WorkspaceStatusCounts } from "../interfaces/workspace.interface.js";
import type { WorkspaceListFilters } from "../validations/workspaceList.schema.js";
import { workspaceListSort } from "../utils/workspaceList.util.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

const WORKSPACE_SELECT = {
    _id: 1,
    name: 1,
    slug: 1,
    description: 1,
    ownerId: 1,
    status: 1,
    visibility: 1,
    isPersonal: 1,
    createdBy: 1,
    updatedBy: 1,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 1,
    deletedBy: 1,
    purgeAfter: 1,
} as const;

export class WorkspaceRepository {
    private readableMembershipStages(
        module = PermissionModule.WORKSPACE,
    ): Array<PipelineStage.Lookup | PipelineStage.Match | PipelineStage.Set | PipelineStage.Unset> {
        return [
            {
                $lookup: {
                    from: RoleModel.collection.name,
                    let: { roleId: { $ifNull: ["$roleId", null] }, workspaceId: "$workspaceId" },
                    pipeline: [
                        {
                            $match: {
                                isActive: true,
                                scope: RoleScope.WORKSPACE,
                                code: { $ne: SYSTEM_ROLE_CODES.WORKSPACE_OWNER },
                                $expr: {
                                    $and: [
                                        {
                                            $or: [
                                                { $eq: ["$_id", "$$roleId"] },
                                                {
                                                    $and: [
                                                        { $eq: ["$$roleId", null] },
                                                        {
                                                            $eq: [
                                                                "$code",
                                                                SYSTEM_ROLE_CODES.WORKSPACE_MEMBER,
                                                            ],
                                                        },
                                                        { $eq: ["$isSystem", true] },
                                                    ],
                                                },
                                            ],
                                        },
                                        {
                                            $or: [
                                                { $eq: ["$workspaceId", "$$workspaceId"] },
                                                {
                                                    $and: [
                                                        { $eq: [{ $ifNull: ["$workspaceId", null] }, null] },
                                                        { $eq: ["$isSystem", true] },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                        {
                            $lookup: {
                                from: PermissionModel.collection.name,
                                localField: "permissions",
                                foreignField: "_id",
                                pipeline: [
                                    {
                                        $match: {
                                            isActive: true,
                                            module: { $in: [PermissionModule.WORKSPACE, module] },
                                        },
                                    },
                                    {
                                        $project: {
                                            _id: 0,
                                            module: 1,
                                            action: 1,
                                            access: 1,
                                            code: 1,
                                            isActive: 1,
                                        },
                                    },
                                ],
                                as: "permissions",
                            },
                        },
                        {
                            $match: {
                                $and: [...new Set([PermissionModule.WORKSPACE, module])].map(
                                    (requiredModule) => ({
                                        permissions: {
                                            $elemMatch: {
                                                module: requiredModule,
                                                action: PermissionAction.READ,
                                                access: {
                                                    $in: [PermissionAccess.GENERAL, PermissionAccess.ANY],
                                                },
                                            },
                                        },
                                    }),
                                ),
                            },
                        },
                        { $project: { _id: 1, name: 1, displayName: 1, permissions: 1 } },
                    ],
                    as: "readableRole",
                },
            },
            { $match: { "readableRole.0": { $exists: true } } },
            {
                $set: {
                    permissions: { $arrayElemAt: ["$readableRole.permissions", 0] },
                    roleName: {
                        $ifNull: [
                            { $arrayElemAt: ["$readableRole.displayName", 0] },
                            { $arrayElemAt: ["$readableRole.name", 0] },
                        ],
                    },
                },
            },
            { $unset: "readableRole" },
        ];
    }

    async findReadableMemberships(userId: string, module = PermissionModule.WORKSPACE) {
        return WorkspaceMemberModel.aggregate<
            NonNullable<WorkspaceListRecord["membership"]> & { workspaceId: Types.ObjectId }
        >([
            { $match: { userId: new Types.ObjectId(userId), status: WorkspaceMemberStatus.ACTIVE } },
            ...this.readableMembershipStages(module),
            {
                $project: {
                    _id: 1,
                    workspaceId: 1,
                    roleId: 1,
                    status: 1,
                    joinedAt: 1,
                    roleName: 1,
                    permissions: 1,
                },
            },
        ]).exec();
    }
    async findNoteWorkspace(id: string) {
        return StickyNoteModel.findById(id).select("workspaceId").lean().exec();
    }
    async listAccessible(userId: string, filters: WorkspaceListFilters) {
        const userObjectId = new Types.ObjectId(userId);
        const { skip, limit } = getPagination(filters.page, filters.limit);
        const match: QueryFilter<IWorkspace> = {
            status: {
                $in: isWorkspaceTrashed(filters.status)
                    ? WORKSPACE_TRASH_STATUSES
                    : [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED],
            },
            ...(filters.visibility ? { visibility: filters.visibility } : {}),
            ...(filters.isPersonal !== undefined ? { isPersonal: filters.isPersonal } : {}),
        };
        if (filters.search) {
            match.name = { $regex: filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        }

        const membershipMatch = { userId: userObjectId, status: WorkspaceMemberStatus.ACTIVE };
        const membershipSelect = { _id: 1, roleId: 1, status: 1, joinedAt: 1, roleName: 1, permissions: 1 };
        const accessStages: PipelineStage.Match[] =
            filters.access === WorkspaceAccessFilter.OWNED
                ? [{ $match: { ownerId: userObjectId } }]
                : filters.access === WorkspaceAccessFilter.SHARED
                  ? [{ $match: { ownerId: { $ne: userObjectId } } }]
                  : [];
        const statusStages: PipelineStage.Match[] =
            filters.status === "ALL"
                ? []
                : [
                      {
                          $match: {
                              status: isWorkspaceTrashed(filters.status)
                                  ? { $in: WORKSPACE_TRASH_STATUSES }
                                  : filters.status,
                          },
                      },
                  ];
        const sort = workspaceListSort(filters);
        const pipeline: PipelineStage[] = [
            { $match: { ...match, ownerId: userObjectId } },
            { $project: WORKSPACE_SELECT },
            {
                $unionWith: {
                    coll: WorkspaceMemberModel.collection.name,
                    pipeline: [
                        { $match: membershipMatch },
                        ...this.readableMembershipStages(),
                        { $project: { workspaceId: 1 } },
                        {
                            $lookup: {
                                from: WorkspaceModel.collection.name,
                                localField: "workspaceId",
                                foreignField: "_id",
                                pipeline: [
                                    {
                                        $match: {
                                            status: {
                                                $in: isWorkspaceTrashed(filters.status)
                                                    ? WORKSPACE_TRASH_STATUSES
                                                    : [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED],
                                            },
                                            ...(filters.visibility ? { visibility: filters.visibility } : {}),
                                            ...(filters.search
                                                ? {
                                                      name: {
                                                          $regex: filters.search.replace(
                                                              /[.*+?^${}()|[\]\\]/g,
                                                              "\\$&",
                                                          ),
                                                          $options: "i",
                                                      },
                                                  }
                                                : {}),
                                            ownerId: { $ne: userObjectId },
                                            ...(filters.isPersonal === true ? { _id: null } : {}),
                                        },
                                    },
                                    { $project: WORKSPACE_SELECT },
                                ],
                                as: "workspace",
                            },
                        },
                        { $unwind: "$workspace" },
                        { $replaceWith: "$workspace" },
                    ],
                },
            },
            {
                $facet: {
                    data: [
                        ...accessStages,
                        ...statusStages,
                        { $sort: sort },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: WorkspaceMemberModel.collection.name,
                                localField: "_id",
                                foreignField: "workspaceId",
                                pipeline: [
                                    { $match: membershipMatch },
                                    ...this.readableMembershipStages(),
                                    { $project: membershipSelect },
                                ],
                                as: "membership",
                            },
                        },
                        { $set: { membership: { $arrayElemAt: ["$membership", 0] } } },
                    ],
                    counts: [...accessStages, { $group: { _id: "$status", total: { $sum: 1 } } }],
                    accessCounts: [
                        ...statusStages,
                        {
                            $group: {
                                _id: {
                                    $cond: [
                                        { $eq: ["$ownerId", userObjectId] },
                                        WorkspaceAccessFilter.OWNED,
                                        WorkspaceAccessFilter.SHARED,
                                    ],
                                },
                                total: { $sum: 1 },
                            },
                        },
                    ],
                },
            },
        ];

        const query = WorkspaceModel.aggregate<{
            data: WorkspaceListRecord[];
            counts: { _id: WorkspaceStatus; total: number }[];
            accessCounts: {
                _id: WorkspaceAccessFilter.OWNED | WorkspaceAccessFilter.SHARED;
                total: number;
            }[];
        }>(pipeline);
        if ("name" in sort || "slug" in sort) {
            query.collation({ locale: "en", strength: 2 });
        }
        const [result] = await query.exec();
        const counts: WorkspaceStatusCounts = { all: 0, active: 0, archived: 0 };
        for (const count of result?.counts ?? []) {
            if (count._id === WorkspaceStatus.ACTIVE) counts.active = count.total;
            if (count._id === WorkspaceStatus.ARCHIVED) counts.archived = count.total;
        }
        counts.all = counts.active + counts.archived;
        const trashTotal = (result?.counts ?? [])
            .filter((count) => isWorkspaceTrashed(count._id))
            .reduce((sum, count) => sum + count.total, 0);
        const total = isWorkspaceTrashed(filters.status)
            ? trashTotal
            : filters.status === "ALL"
              ? counts.all
              : filters.status === WorkspaceStatus.ACTIVE
                ? counts.active
                : counts.archived;
        const accessCounts = { ALL: 0, OWNED: 0, SHARED: 0 };
        for (const count of result?.accessCounts ?? []) accessCounts[count._id] = count.total;
        accessCounts.ALL = accessCounts.OWNED + accessCounts.SHARED;
        return {
            data: result?.data ?? [],
            pagination: paginationMeta(filters.page, limit, total),
            counts,
            accessCounts,
        };
    }

    async findDropdownWorkspaces(userId: string): Promise<Array<{ _id: Types.ObjectId; name: string }>> {
        const userObjectId = new Types.ObjectId(userId);
        const memberships = await this.findReadableMemberships(userId);
        const memberWorkspaceIds = memberships.map((m) => m.workspaceId);

        const query: QueryFilter<IWorkspace> = {
            status: WorkspaceStatus.ACTIVE,
            $or: [
                { ownerId: userObjectId },
                ...(memberWorkspaceIds.length
                    ? [
                          {
                              _id: { $in: memberWorkspaceIds },
                              isPersonal: { $ne: true },
                          },
                      ]
                    : []),
            ],
        };

        return WorkspaceModel.find(query)
            .select({ _id: 1, name: 1 })
            .sort({ isPersonal: -1, name: 1, _id: 1 })
            .lean()
            .exec();
    }

    // Same owner/creator/active-member access rule used by Sticky Note assignees and favorites.
    async findAccessibleIds(
        userId: string,
        workspaceId?: string,
        session?: ClientSession,
    ): Promise<Types.ObjectId[]> {
        const userObjectId = new Types.ObjectId(userId);
        const memberships = await WorkspaceMemberModel.find({
            userId: userObjectId,
            status: WorkspaceMemberStatus.ACTIVE,
            ...(workspaceId ? { workspaceId: new Types.ObjectId(workspaceId) } : {}),
        })
            .select("workspaceId")
            .session(session ?? null)
            .lean()
            .exec();
        const workspaces = await WorkspaceModel.find({
            status: { $nin: WORKSPACE_TRASH_STATUSES },
            ...(workspaceId ? { _id: new Types.ObjectId(workspaceId) } : {}),
            $or: [
                { ownerId: userObjectId },
                { createdBy: userObjectId },
                { _id: { $in: memberships.map((member) => member.workspaceId) } },
            ],
        })
            .select("_id")
            .session(session ?? null)
            .lean()
            .exec();
        return workspaces.map((workspace) => workspace._id);
    }

    async create(data: Partial<IWorkspace>) {
        return WorkspaceModel.create(data);
    }

    async findById(id: string) {
        return WorkspaceModel.findOne({
            _id: new Types.ObjectId(id),
            status: { $nin: WORKSPACE_TRASH_STATUSES },
        })
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async findByIdIncludingDeleted(id: string) {
        return WorkspaceModel.findById(new Types.ObjectId(id)).select(WORKSPACE_SELECT).lean().exec();
    }

    async findBySlug(slug: string) {
        return WorkspaceModel.findOne({ slug: slug.toLowerCase().trim() })
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async findByOwnerAndPersonal(ownerId: string, isPersonal: boolean) {
        return WorkspaceModel.findOne({
            ownerId: new Types.ObjectId(ownerId),
            isPersonal,
            status: { $nin: WORKSPACE_TRASH_STATUSES },
        })
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async findAll(filters: IWorkspaceFilter = {}) {
        const {
            page = WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            sortBy = WORKSPACE_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder = WORKSPACE_CONSTANTS.DEFAULT_SORT_ORDER,
        } = filters;

        const query = this.buildFilterQuery(filters);
        const skip = (page - 1) * limit;
        const direction = sortOrder === "asc" ? 1 : -1;
        const [data, total] = await Promise.all([
            WorkspaceModel.find(query)
                .select(WORKSPACE_SELECT)
                .sort({ [sortBy]: direction, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            WorkspaceModel.countDocuments(query).exec(),
        ]);

        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async findAccessibleByUser(
        userId: string,
        memberWorkspaceIds: string[] = [],
        filters: IWorkspaceFilter = {},
    ) {
        const {
            page = WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            sortBy = WORKSPACE_CONSTANTS.DEFAULT_SORT_BY,
            sortOrder = WORKSPACE_CONSTANTS.DEFAULT_SORT_ORDER,
        } = filters;

        const query = this.buildFilterQuery({ ...filters, ownerId: undefined });
        const accessConditions: QueryFilter<IWorkspace>[] = [{ ownerId: new Types.ObjectId(userId) }];

        if (memberWorkspaceIds.length && filters.isPersonal !== true) {
            accessConditions.push({
                _id: { $in: memberWorkspaceIds.map((workspaceId) => new Types.ObjectId(workspaceId)) },
                status: { $nin: [WorkspaceStatus.INACTIVE, WorkspaceStatus.SUSPENDED] },
            });
        }

        const existingAnd = Array.isArray(query.$and) ? query.$and : [];
        query.$and = [...existingAnd, { $or: accessConditions }];

        const skip = (page - 1) * limit;
        const direction = sortOrder === "asc" ? 1 : -1;
        const [data, total] = await Promise.all([
            WorkspaceModel.find(query)
                .select(WORKSPACE_SELECT)
                .sort({ isPersonal: -1, [sortBy]: direction, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            WorkspaceModel.countDocuments(query).exec(),
        ]);

        return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async existsBySlug(slug: string): Promise<boolean> {
        const exists = await WorkspaceModel.exists({ slug: slug.toLowerCase().trim() });
        return !!exists;
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await WorkspaceModel.exists({ _id: new Types.ObjectId(id) });
        return !!exists;
    }

    async updateById(id: string, data: Partial<IWorkspace>) {
        return WorkspaceModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), status: { $nin: WORKSPACE_TRASH_STATUSES } },
            { $set: data },
            { returnDocument: "after", runValidators: true },
        )
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async updateStatus(id: string, status: WorkspaceStatus, updatedBy?: IWorkspace["updatedBy"]) {
        return WorkspaceModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), status: { $nin: WORKSPACE_TRASH_STATUSES } },
            { $set: { status, ...(updatedBy !== undefined ? { updatedBy } : {}) } },
            { returnDocument: "after", runValidators: true },
        )
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async softDelete(id: string, updatedBy?: IWorkspace["updatedBy"]) {
        const now = new Date();
        return WorkspaceModel.findOneAndUpdate(
            { _id: new Types.ObjectId(id), status: { $nin: WORKSPACE_TRASH_STATUSES }, isPersonal: false },
            {
                $set: {
                    status: WorkspaceStatus.TRASHED,
                    deletedAt: now,
                    deletedBy: updatedBy ?? null,
                    purgeAfter: new Date(now.getTime() + WORKSPACE_CONSTANTS.TRASH.RETENTION_DAYS * 86400000),
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
                },
            },
            { returnDocument: "after", runValidators: true },
        )
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async restore(id: string, updatedBy?: IWorkspace["updatedBy"]) {
        return WorkspaceModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                status: { $in: WORKSPACE_TRASH_STATUSES },
                $or: [{ purgeAfter: null }, { purgeAfter: { $gt: new Date() } }],
            },
            {
                $set: {
                    status: WorkspaceStatus.ACTIVE,
                    deletedAt: null,
                    deletedBy: null,
                    purgeAfter: null,
                    ...(updatedBy !== undefined ? { updatedBy } : {}),
                },
            },
            { returnDocument: "after", runValidators: true },
        )
            .select(WORKSPACE_SELECT)
            .lean()
            .exec();
    }

    async hardDeleteById(id: string) {
        return WorkspaceModel.findByIdAndDelete(new Types.ObjectId(id)).exec();
    }

    async findUnavailableIds(): Promise<Types.ObjectId[]> {
        const rows = await WorkspaceModel.find({ status: { $in: WORKSPACE_TRASH_STATUSES } })
            .select("_id")
            .lean()
            .exec();
        return rows.map((row) => row._id);
    }

    async findExpiredTrashedIds(
        now = new Date(),
        limit = WORKSPACE_CONSTANTS.TRASH.PURGE_BATCH_SIZE,
    ): Promise<string[]> {
        const rows = await WorkspaceModel.find({
            status: { $in: WORKSPACE_TRASH_STATUSES },
            isPersonal: false,
            purgeAfter: { $ne: null, $lte: now },
        })
            .sort({ purgeAfter: 1, _id: 1 })
            .limit(limit)
            .select("_id")
            .lean()
            .exec();
        return rows.map((row) => row._id.toString());
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
                if (result === undefined) throw new Error("Workspace transaction did not complete.");
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
        const query = WorkspaceModel.findById(id).select("_id status isPersonal");
        if (session) query.session(session);
        return query.lean().exec();
    }

    async hasSharedRoles(id: string, session?: ClientSession): Promise<boolean> {
        const workspaceId = new Types.ObjectId(id);
        const rolesQuery = RoleModel.find({ workspaceId }).select("_id isSystem");
        if (session) rolesQuery.session(session);
        const roles = await rolesQuery.lean().exec();
        if (roles.some((role) => role.isSystem)) return true;
        const roleIds = roles.map((role) => role._id);
        if (!roleIds.length) return false;
        // Never delete a role that is still referenced outside the target workspace.
        const memberCheck = WorkspaceMemberModel.exists({
            workspaceId: { $ne: workspaceId },
            roleId: { $in: roleIds },
        });
        if (session) memberCheck.session(session);
        if (await memberCheck) return true;

        const invitationCheck = WorkspaceMemberInvitationModel.exists({
            workspaceId: { $ne: workspaceId },
            roleId: { $in: roleIds },
        });
        if (session) invitationCheck.session(session);
        if (await invitationCheck) return true;

        const userCheck = UserModel.exists({ globalRoleId: { $in: roleIds } });
        if (session) userCheck.session(session);
        return Boolean(await userCheck);
    }

    async deleteDependentData(id: string, session?: ClientSession) {
        const workspaceId = new Types.ObjectId(id);
        const notesQuery = StickyNoteModel.find({ workspaceId }).select("_id");
        if (session) notesQuery.session(session);
        const notes = await notesQuery.lean().exec();
        const noteIds = notes.map((note) => note._id);
        const noteFilter = { stickyNoteId: { $in: noteIds } };
        const checklistsQuery = StickyNoteChecklistModel.find(noteFilter).select("_id");
        if (session) checklistsQuery.session(session);
        const checklists = await checklistsQuery.lean().exec();

        // File deletion happens only after commit. Tombstones allow failed storage requests to be retried.
        const mediaQuery = MediaModel.updateMany(
            {
                $or: [
                    { resourceType: MediaResourceType.WORKSPACE, resourceId: workspaceId },
                    { resourceType: MediaResourceType.NOTE, resourceId: { $in: noteIds } },
                ],
            },
            {
                $set: {
                    status: MediaStatus.DELETED,
                    deletedAt: new Date(),
                    storageDeletionPending: true,
                    resourceId: null,
                    resourceType: null,
                    publicUrl: null,
                },
            },
        );
        if (session) mediaQuery.session(session);
        const media = await mediaQuery.exec();

        const itemsQuery = StickyNoteChecklistItemModel.deleteMany({
            checklistId: { $in: checklists.map((row) => row._id) },
        });
        if (session) itemsQuery.session(session);
        const items = await itemsQuery.exec();

        const deletedChecklistsQuery = StickyNoteChecklistModel.deleteMany(noteFilter);
        if (session) deletedChecklistsQuery.session(session);
        const deletedChecklists = await deletedChecklistsQuery.exec();

        const favQuery = StickyNoteFavoriteModel.deleteMany(noteFilter);
        if (session) favQuery.session(session);
        await favQuery.exec();

        const assigneeQuery = StickyNoteAssigneeModel.deleteMany({ $or: [{ workspaceId }, noteFilter] });
        if (session) assigneeQuery.session(session);
        await assigneeQuery.exec();

        const deletedNotesQuery = StickyNoteModel.deleteMany({ workspaceId });
        if (session) deletedNotesQuery.session(session);
        const deletedNotes = await deletedNotesQuery.exec();

        const counterQuery = StickyNoteCounterModel.deleteMany({ workspaceId });
        if (session) counterQuery.session(session);
        await counterQuery.exec();

        const columnQuery = StickyNoteColumnModel.deleteMany({ workspaceId });
        if (session) columnQuery.session(session);
        await columnQuery.exec();

        const labelQuery = StickyNoteLabelModel.deleteMany({ workspaceId });
        if (session) labelQuery.session(session);
        await labelQuery.exec();

        const folderQuery = WorkspaceFolderModel.deleteMany({ workspaceId });
        if (session) folderQuery.session(session);
        const folders = await folderQuery.exec();

        const invitationQuery = WorkspaceMemberInvitationModel.deleteMany({ workspaceId });
        if (session) invitationQuery.session(session);
        const invitations = await invitationQuery.exec();

        const memberQuery = WorkspaceMemberModel.deleteMany({ workspaceId });
        if (session) memberQuery.session(session);
        const members = await memberQuery.exec();

        const roleQuery = RoleModel.deleteMany({ workspaceId, isSystem: { $ne: true } });
        if (session) roleQuery.session(session);
        const roles = await roleQuery.exec();

        const workspaceQuery = WorkspaceModel.deleteOne({
            _id: workspaceId,
            status: { $in: WORKSPACE_TRASH_STATUSES },
            isPersonal: false,
        });
        if (session) workspaceQuery.session(session);
        const workspace = await workspaceQuery.exec();

        return {
            workspaceId: id,
            deletedWorkspaces: workspace.deletedCount,
            deletedStickyNotes: deletedNotes.deletedCount,
            deletedChecklists: deletedChecklists.deletedCount,
            deletedChecklistItems: items.deletedCount,
            deletedFolders: folders.deletedCount,
            deletedMembers: members.deletedCount,
            deletedInvitations: invitations.deletedCount,
            deletedRoles: roles.deletedCount,
            queuedMedia: media.modifiedCount,
        };
    }

    async rollbackById(id: string, data: Record<string, unknown>) {
        return WorkspaceModel.findByIdAndUpdate(
            new Types.ObjectId(id),
            { $set: data },
            { returnDocument: "after", runValidators: false, timestamps: false },
        ).exec();
    }

    private buildFilterQuery(filters: IWorkspaceFilter): QueryFilter<IWorkspace> {
        const query: QueryFilter<IWorkspace> = {};
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

        if (filters.ownerId) {
            query.ownerId =
                typeof filters.ownerId === "string" ? new Types.ObjectId(filters.ownerId) : filters.ownerId;
        }

        query.status = isWorkspaceTrashed(filters.status)
            ? { $in: WORKSPACE_TRASH_STATUSES }
            : (filters.status ?? { $nin: WORKSPACE_TRASH_STATUSES });

        if (filters.visibility) {
            query.visibility = filters.visibility;
        }

        if (filters.isPersonal !== undefined) {
            query.isPersonal = filters.isPersonal;
        }

        return query;
    }
}
