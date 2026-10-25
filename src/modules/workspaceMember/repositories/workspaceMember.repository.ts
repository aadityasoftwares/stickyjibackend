import type { ClientSession, PipelineStage } from "mongoose";
import { Types } from "mongoose";

import { WorkspaceMemberModel } from "../models/workspaceMember.model.js";
import type { IWorkspaceMember, IWorkspaceMemberFilter } from "../interfaces/workspaceMember.interface.js";
import { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";
import { WORKSPACE_MEMBER_CONSTANTS } from "../constants/workspaceMember.constants.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

import { UserModel } from "../../user/models/user.model.js";
import { UserProfileModel } from "../../userprofile/models/userProfile.model.js";
import { RoleModel } from "../../roles/models/role.model.js";

const MEMBER_POPULATE = [
    {
        path: "workspaceId",
        select: "_id name slug ownerId",
    },
    {
        path: "userId",
        select: "_id email username",
    },
    {
        path: "roleId",
        select: "_id name displayName code",
    },
    {
        path: "invitedBy",
        select: "_id email",
    },
    {
        path: "createdBy",
        select: "_id email",
    },
    {
        path: "updatedBy",
        select: "_id email",
    },
];

const ALLOWED_SORT_FIELDS = new Set(["createdAt", "updatedAt", "joinedAt", "status"]);

export interface WorkspaceMemberListRawRow {
    memberId: Types.ObjectId;
    userId: Types.ObjectId;
    roleId: Types.ObjectId;
    status: WorkspaceMemberStatus;
    joinedAt?: Date | null;

    userEmail?: string | null;
    userLastLoginAt?: Date | null;

    profileDisplayName?: string | null;
    profileFirstName?: string | null;
    profileLastName?: string | null;
    profileImageId?: Types.ObjectId | null;
    profileAvatarUrl?: string | null;

    roleName?: string | null;
    roleDisplayName?: string | null;
    roleCode?: string | null;

    invitedBy?: Types.ObjectId | null;
    inviterEmail?: string | null;
    inviterProfileDisplayName?: string | null;
    inviterProfileFirstName?: string | null;
    inviterProfileLastName?: string | null;
    inviterProfileImageId?: Types.ObjectId | null;
    inviterProfileAvatarUrl?: string | null;
}

export interface ActivateWorkspaceMemberFromInvitationInput {
    workspaceId: Types.ObjectId;
    userId: Types.ObjectId;
    roleId: Types.ObjectId;
    invitedBy: Types.ObjectId;
    actorId: Types.ObjectId;
    joinedAt: Date;
}

export class WorkspaceMemberRepository {
    async userExists(id: string): Promise<boolean> {
        return Boolean(await UserModel.exists({ _id: new Types.ObjectId(id), isDeleted: false }));
    }

    async findRoleById(id: string) {
        return RoleModel.findById(id)
            .select("_id code scope workspaceId isSystem isActive priority")
            .lean()
            .exec();
    }

    async hardDeleteById(id: string): Promise<void> {
        await WorkspaceMemberModel.deleteOne({ _id: new Types.ObjectId(id) });
    }
    async create(data: Partial<IWorkspaceMember>) {
        const member = await WorkspaceMemberModel.create(data);

        return this.findById(member._id.toString());
    }

    async findById(id: string) {
        return WorkspaceMemberModel.findById(id).populate(MEMBER_POPULATE).lean().exec();
    }

    async findAuthorizationTarget(id: string) {
        return WorkspaceMemberModel.findById(id).select("_id workspaceId userId roleId status").lean().exec();
    }

    async findByIdIncludingRemoved(id: string) {
        return this.findById(id);
    }

    async findByUserId(userId: string) {
        return WorkspaceMemberModel.find({
            userId: new Types.ObjectId(userId),
        })
            .select("_id workspaceId userId roleId status joinedAt createdAt")
            .lean()
            .exec();
    }

    async findByWorkspaceAndUser(workspaceId: string, userId: string) {
        return WorkspaceMemberModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
        })
            .populate(MEMBER_POPULATE)
            .lean()
            .exec();
    }

    async findMembershipIdentity(workspaceId: string, userId: string) {
        return WorkspaceMemberModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
        })
            .select("_id workspaceId userId roleId status joinedAt")
            .lean()
            .exec();
    }

    async findActiveByWorkspaceAndUser(workspaceId: string, userId: string) {
        return WorkspaceMemberModel.findOne({
            workspaceId: new Types.ObjectId(workspaceId),
            userId: new Types.ObjectId(userId),
            status: WorkspaceMemberStatus.ACTIVE,
        })
            .populate(MEMBER_POPULATE)
            .lean()
            .exec();
    }

    /**
     * Lightweight member-list query used by the people screen.
     *
     * Important:
     * - workspace is NOT populated on every row
     * - complete User documents are NOT returned
     * - role permissions are NOT returned
     * - createdBy / updatedBy are NOT returned
     * - profile is joined only for the display name
     * - inviter is joined only for the "Added by" label
     *
     * Search is applied inside MongoDB before pagination so the total count
     * remains correct.
     */
    async findAllForList(filters: IWorkspaceMemberFilter): Promise<{
        data: WorkspaceMemberListRawRow[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }> {
        const {
            page = WORKSPACE_MEMBER_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_MEMBER_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            workspaceId,
            userId,
            roleId,
            status,
            search,
            sortBy = "updatedAt",
            sortOrder = "desc",
        } = filters;

        const safePage = Math.max(Number(page) || WORKSPACE_MEMBER_CONSTANTS.PAGINATION.DEFAULT_PAGE, 1);

        const safeLimit = Math.min(
            Math.max(Number(limit) || WORKSPACE_MEMBER_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
            WORKSPACE_MEMBER_CONSTANTS.PAGINATION.MAX_LIMIT,
        );

        const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "updatedAt";

        const direction: 1 | -1 = sortOrder === "asc" ? 1 : -1;

        const match: Record<string, unknown> = {};

        if (workspaceId) {
            match.workspaceId = new Types.ObjectId(workspaceId);
        }

        if (userId) {
            match.userId = new Types.ObjectId(userId);
        }

        if (roleId) {
            match.roleId = new Types.ObjectId(roleId);
        }

        if (status) {
            match.status = status;
        }

        const pipeline: PipelineStage[] = [
            {
                $match: match,
            },

            {
                $lookup: {
                    from: UserModel.collection.name,
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $lookup: {
                    from: UserProfileModel.collection.name,
                    localField: "userId",
                    foreignField: "userId",
                    as: "profile",
                },
            },
            {
                $unwind: {
                    path: "$profile",
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $lookup: {
                    from: RoleModel.collection.name,
                    localField: "roleId",
                    foreignField: "_id",
                    as: "role",
                },
            },
            {
                $unwind: {
                    path: "$role",
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $lookup: {
                    from: UserModel.collection.name,
                    localField: "invitedBy",
                    foreignField: "_id",
                    as: "inviter",
                },
            },
            {
                $unwind: {
                    path: "$inviter",
                    preserveNullAndEmptyArrays: true,
                },
            },

            {
                $lookup: {
                    from: UserProfileModel.collection.name,
                    localField: "invitedBy",
                    foreignField: "userId",
                    as: "inviterProfile",
                },
            },
            {
                $unwind: {
                    path: "$inviterProfile",
                    preserveNullAndEmptyArrays: true,
                },
            },
        ];

        const normalizedSearch = search?.trim();

        if (normalizedSearch) {
            const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const searchRegex = new RegExp(escapedSearch, "i");

            pipeline.push({
                $match: {
                    $or: [
                        {
                            "user.email": searchRegex,
                        },
                        {
                            "profile.displayName": searchRegex,
                        },
                        {
                            "profile.firstName": searchRegex,
                        },
                        {
                            "profile.lastName": searchRegex,
                        },
                        {
                            "role.displayName": searchRegex,
                        },
                        {
                            "role.name": searchRegex,
                        },
                        {
                            "role.code": searchRegex,
                        },
                    ],
                },
            });
        }

        const { skip } = getPagination(safePage, safeLimit);

        pipeline.push({
            $facet: {
                data: [
                    {
                        $sort: {
                            [safeSortBy]: direction,
                            _id: direction,
                        },
                    },
                    {
                        $skip: skip,
                    },
                    {
                        $limit: safeLimit,
                    },
                    {
                        $project: {
                            _id: 0,
                            memberId: "$_id",
                            userId: 1,
                            roleId: 1,
                            status: 1,
                            joinedAt: 1,

                            userEmail: "$user.email",
                            userLastLoginAt: "$user.lastLoginAt",

                            profileDisplayName: "$profile.displayName",
                            profileFirstName: "$profile.firstName",
                            profileLastName: "$profile.lastName",
                            profileImageId: "$profile.profileImage",
                            profileAvatarUrl: "$profile.avatarUrl",

                            roleName: "$role.name",
                            roleDisplayName: "$role.displayName",
                            roleCode: "$role.code",

                            invitedBy: 1,
                            inviterEmail: "$inviter.email",
                            inviterProfileDisplayName: "$inviterProfile.displayName",
                            inviterProfileFirstName: "$inviterProfile.firstName",
                            inviterProfileLastName: "$inviterProfile.lastName",
                            inviterProfileImageId: "$inviterProfile.profileImage",
                            inviterProfileAvatarUrl: "$inviterProfile.avatarUrl",
                        },
                    },
                ],
                meta: [
                    {
                        $count: "total",
                    },
                ],
            },
        });

        const [result] = await WorkspaceMemberModel.aggregate<{
            data: WorkspaceMemberListRawRow[];
            meta: Array<{
                total: number;
            }>;
        }>(pipeline).exec();

        const data = result?.data ?? [];

        const total = result?.meta?.[0]?.total ?? 0;

        return {
            data,
            pagination: paginationMeta(safePage, safeLimit, total),
        };
    }

    async existsById(id: string): Promise<boolean> {
        return Boolean(
            await WorkspaceMemberModel.exists({
                _id: new Types.ObjectId(id),
            }),
        );
    }

    async existsByWorkspaceAndUser(workspaceId: string, userId: string): Promise<boolean> {
        return Boolean(
            await WorkspaceMemberModel.exists({
                workspaceId: new Types.ObjectId(workspaceId),
                userId: new Types.ObjectId(userId),
            }),
        );
    }

    async updateById(id: string, data: Partial<IWorkspaceMember>) {
        return WorkspaceMemberModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
            },
            {
                $set: data,
            },
            {
                returnDocument: "after",
                runValidators: true,
            },
        )
            .populate(MEMBER_POPULATE)
            .lean()
            .exec();
    }

    async updateRole(
        id: string,
        roleId: IWorkspaceMember["roleId"],
        updatedBy?: IWorkspaceMember["updatedBy"],
        expectedRoleId?: IWorkspaceMember["roleId"],
    ) {
        return WorkspaceMemberModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                ...(expectedRoleId ? { roleId: expectedRoleId } : {}),
                status: WorkspaceMemberStatus.ACTIVE,
            },
            {
                $set: {
                    roleId,
                    ...(updatedBy !== undefined
                        ? {
                              updatedBy,
                          }
                        : {}),
                },
            },
            {
                returnDocument: "after",
                runValidators: true,
            },
        )
            .populate(MEMBER_POPULATE)
            .lean()
            .exec();
    }

    async updateStatus(
        id: string,
        status: WorkspaceMemberStatus,
        updatedBy?: IWorkspaceMember["updatedBy"],
        expectedStatus?: WorkspaceMemberStatus,
        expectedRoleId?: IWorkspaceMember["roleId"],
    ) {
        return WorkspaceMemberModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                ...(expectedStatus ? { status: expectedStatus } : {}),
                ...(expectedRoleId ? { roleId: expectedRoleId } : {}),
            },
            {
                $set: {
                    status,
                    ...(updatedBy !== undefined
                        ? {
                              updatedBy,
                          }
                        : {}),
                },
            },
            {
                returnDocument: "after",
                runValidators: true,
            },
        )
            .populate(MEMBER_POPULATE)
            .lean()
            .exec();
    }

    async remove(
        id: string,
        updatedBy?: IWorkspaceMember["updatedBy"],
        expectedStatus?: WorkspaceMemberStatus,
        expectedRoleId?: IWorkspaceMember["roleId"],
    ) {
        return this.updateStatus(
            id,
            WorkspaceMemberStatus.REMOVED,
            updatedBy,
            expectedStatus,
            expectedRoleId,
        );
    }

    async restore(
        id: string,
        updatedBy?: IWorkspaceMember["updatedBy"],
        expectedRoleId?: IWorkspaceMember["roleId"],
    ) {
        return this.updateStatus(
            id,
            WorkspaceMemberStatus.ACTIVE,
            updatedBy,
            WorkspaceMemberStatus.REMOVED,
            expectedRoleId,
        );
    }

    async activateFromInvitation(input: ActivateWorkspaceMemberFromInvitationInput, session?: ClientSession) {
        return WorkspaceMemberModel.findOneAndUpdate(
            {
                workspaceId: input.workspaceId,
                userId: input.userId,
            },
            {
                $set: {
                    roleId: input.roleId,
                    status: WorkspaceMemberStatus.ACTIVE,
                    invitedBy: input.invitedBy,
                    joinedAt: input.joinedAt,
                    updatedBy: input.actorId,
                },
                $setOnInsert: {
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    createdBy: input.actorId,
                },
            },
            {
                upsert: true,
                returnDocument: "after",
                runValidators: true,
                setDefaultsOnInsert: true,
                ...(session ? { session } : {}),
            },
        )
            .select("_id workspaceId userId roleId status joinedAt")
            .lean()
            .exec();
    }

    async getActiveMemberSummariesByWorkspaceIds(
        workspaceIds: string[],
        previewLimit = 4,
    ): Promise<
        Map<
            string,
            {
                count: number;
                members: Array<{
                    id: string;
                    displayName: string;
                    email: string;
                    role: string;
                    isOwner: boolean;
                }>;
            }
        >
    > {
        if (!workspaceIds.length) {
            return new Map();
        }

        const ids = workspaceIds
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (!ids.length) {
            return new Map();
        }

        const rows = await WorkspaceMemberModel.aggregate([
            {
                $match: {
                    workspaceId: { $in: ids },
                    status: WorkspaceMemberStatus.ACTIVE,
                },
            },
            {
                $lookup: {
                    from: UserModel.collection.name,
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $lookup: {
                    from: RoleModel.collection.name,
                    localField: "roleId",
                    foreignField: "_id",
                    as: "role",
                },
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: "$role",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $sort: {
                    joinedAt: 1,
                    _id: 1,
                },
            },
            {
                $group: {
                    _id: "$workspaceId",
                    count: { $sum: 1 },
                    members: {
                        $push: {
                            id: "$userId",
                            email: "$user.email",
                            displayName: {
                                $ifNull: ["$user.displayName", "$user.email"],
                            },
                            role: {
                                $ifNull: [
                                    "$role.displayName",
                                    {
                                        $ifNull: ["$role.name", "Member"],
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    count: 1,
                    members: {
                        $slice: ["$members", Math.max(1, previewLimit - 1)],
                    },
                },
            },
        ]).exec();

        return new Map(
            rows.map((row: any) => [
                String(row._id),
                {
                    count: Number(row.count ?? 0),
                    members: (row.members ?? []).map((member: any) => ({
                        id: String(member.id ?? ""),
                        displayName: String(member.displayName ?? member.email ?? "Workspace member").trim(),
                        email: String(member.email ?? "").trim(),
                        role: String(member.role ?? "Member").trim(),
                        isOwner: false,
                    })),
                },
            ]),
        );
    }
}
