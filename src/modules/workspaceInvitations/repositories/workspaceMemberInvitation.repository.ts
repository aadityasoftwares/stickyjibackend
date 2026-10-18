import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import mongoose, { Types, type ClientSession } from "mongoose";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberStatus } from "../../workspaceMember/constants/workspaceMember.enums.js";
import type { IWorkspaceMember } from "../../workspaceMember/interfaces/workspaceMember.interface.js";
import { UserModel } from "../../user/models/user.model.js";
import { UserProfileModel } from "../../userprofile/models/userProfile.model.js";
import { RoleModel } from "../../roles/models/role.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceStatus } from "../../workspace/constants/workspace.enums.js";
import { PermissionModule } from "../../permissions/constants/permission.enums.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

import { WorkspaceMemberInvitationModel } from "../models/workspaceMemberInvitation.model.js";
import type {
    IWorkspaceMemberInvitation,
    IWorkspaceMemberInvitationFilter,
} from "../interfaces/workspaceMemberInvitation.interface.js";
import { WorkspaceInvitationStatus } from "../constants/workspaceMemberInvitation.enums.js";
import { WORKSPACE_MEMBER_INVITATION_CONSTANTS } from "../constants/workspaceMemberInvitation.constants.js";

const INVITATION_POPULATE = [
    {
        path: "workspaceId",
        select: "_id name slug",
    },
    {
        path: "userId",
        select: "_id email",
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

const ALLOWED_SORT_FIELDS = new Set(["createdAt", "updatedAt", "expiresAt", "acceptedAt", "email", "status"]);

export class WorkspaceMemberInvitationRepository {
    async runInTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
        // A duplicate-key race aborts a transaction; retry from a fresh snapshot.
        for (let attempt = 0; ; attempt++) {
            try {
                return await mongoose.connection.transaction(operation);
            } catch (error) {
                if (attempt >= 2 || !this.isOnlyDuplicateKeyBulkWriteError(error)) throw error;
            }
        }
    }

    async findReadableWorkspaceIds(userId: string) {
        const memberships = await new WorkspaceRepository().findReadableMemberships(userId, PermissionModule.MEMBERS);
        const workspaces = await WorkspaceModel.find({
            status: { $in: [WorkspaceStatus.ACTIVE, WorkspaceStatus.ARCHIVED] },
            $or: [{ ownerId: new Types.ObjectId(userId) }, { _id: { $in: memberships.map((m) => m.workspaceId) } }],
        })
            .select("_id")
            .lean()
            .exec();
        return workspaces.map((workspace) => workspace._id.toString());
    }

    findUsersByEmails(emails: string[]) {
        return UserModel.find({ email: { $in: emails }, isDeleted: false })
            .select("_id email")
            .lean()
            .exec();
    }
    findUserByEmail(email: string) {
        return UserModel.findOne({ email, isDeleted: false }).select("_id email").lean().exec();
    }
    findUserById(id: string, session: ClientSession) {
        return UserModel.findOne({ _id: id, isDeleted: false }).select("_id email").session(session).lean().exec();
    }
    findRolesByIds(ids: string[]) {
        return RoleModel.find({ _id: { $in: ids } })
            .select("_id name displayName code scope workspaceId isSystem isActive priority")
            .lean()
            .exec();
    }
    findRole(id: string, session?: ClientSession) {
        return RoleModel.findById(id)
            .select("_id name displayName code scope workspaceId isSystem isActive priority")
            .session(session ?? null)
            .lean()
            .exec();
    }
    findProfiles(ids: Types.ObjectId[]) {
        return UserProfileModel.find({ userId: { $in: ids } })
            .select("userId firstName lastName displayName")
            .lean()
            .exec();
    }
    findProfile(id: string) {
        return UserProfileModel.findOne({ userId: id }).select("userId firstName lastName displayName").lean().exec();
    }
    findMemberships(workspaceId: string, ids: Types.ObjectId[]) {
        if (!ids.length) return Promise.resolve([]);
        return WorkspaceMemberModel.find({ workspaceId, userId: { $in: ids } })
            .select("userId status")
            .lean()
            .exec();
    }
    findMembership(workspaceId: string, userId: Types.ObjectId, session?: ClientSession) {
        return WorkspaceMemberModel.findOne({ workspaceId, userId })
            .select("_id status")
            .session(session ?? null)
            .lean()
            .exec();
    }
    findWorkspace(id: string, session: ClientSession) {
        return WorkspaceModel.findById(id)
            .select("_id name slug ownerId status isPersonal")
            .session(session)
            .lean()
            .exec();
    }
    findTokenForAcceptance(tokenHash: string, session: ClientSession) {
        return WorkspaceMemberInvitationModel.findOne({ tokenHash }).session(session).lean().exec();
    }
    async activateMembership(
        data: Partial<IWorkspaceMember>,
        existing: { _id: Types.ObjectId; status: WorkspaceMemberStatus } | null,
        session: ClientSession,
    ) {
        if (existing) {
            return WorkspaceMemberModel.findOneAndUpdate(
                { _id: existing._id, status: existing.status },
                { $set: data },
                { new: true, runValidators: true, session },
            )
                .select("_id")
                .lean()
                .exec();
        }
        const [member] = await WorkspaceMemberModel.create([{ ...data, createdBy: data.userId }], { session });
        return member;
    }

    async create(data: Partial<IWorkspaceMemberInvitation>) {
        const invitation = await WorkspaceMemberInvitationModel.create(data);

        const result = invitation.toObject();

        delete (result as Partial<IWorkspaceMemberInvitation>).tokenHash;

        return result;
    }

    /**
     * Creates only invitations that do not already have a PENDING row.
     * The pre-generated _id values let the service identify which rows were
     * actually inserted without exposing or re-reading existing invitations.
     */
    async createPendingBatchIfMissing(
        invitations: Array<
            Partial<IWorkspaceMemberInvitation> & {
                _id: Types.ObjectId;
            }
        >,
        session?: ClientSession,
    ) {
        if (invitations.length === 0) {
            return [];
        }

        try {
            await WorkspaceMemberInvitationModel.bulkWrite(
                invitations.map((invitation) => ({
                    updateOne: {
                        filter: {
                            workspaceId: invitation.workspaceId,
                            email: invitation.email,
                            status: WorkspaceInvitationStatus.PENDING,
                        },
                        update: {
                            $setOnInsert: invitation,
                        },
                        upsert: true,
                        timestamps: false,
                    },
                })),
                {
                    ordered: true,
                    session,
                },
            );
        } catch (error) {
            /*
             * A concurrent request can win the unique PENDING invitation race
             * after this request has already evaluated its upsert filter. The
             * unique partial index is the source of truth, so duplicate-key
             * write errors are safe to treat as "already pending". Any other
             * database error must still fail the request.
             */
            if (session || !this.isOnlyDuplicateKeyBulkWriteError(error)) {
                throw error;
            }
        }

        const invitationIds = invitations.map((invitation) => invitation._id);

        return WorkspaceMemberInvitationModel.find({
            _id: {
                $in: invitationIds,
            },
        })
            .session(session ?? null)
            .lean()
            .exec();
    }

    async expirePendingByWorkspaceAndEmails(workspaceId: string, emails: string[], now: Date) {
        if (emails.length === 0) {
            return;
        }

        await WorkspaceMemberInvitationModel.updateMany(
            {
                workspaceId: new Types.ObjectId(workspaceId),
                email: {
                    $in: emails,
                },
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: {
                    $lte: now,
                },
            },
            {
                $set: {
                    status: WorkspaceInvitationStatus.EXPIRED,
                    updatedAt: now,
                },
            },
        ).exec();
    }

    async expirePendingById(id: string, updatedBy: Types.ObjectId, now: Date) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                _id: id,
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: {
                    $lte: now,
                },
            },
            {
                $set: {
                    status: WorkspaceInvitationStatus.EXPIRED,
                    updatedBy,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .select("_id status")
            .lean()
            .exec();
    }

    async findById(id: string) {
        return WorkspaceMemberInvitationModel.findById(id).populate(INVITATION_POPULATE).lean().exec();
    }

    async findByIdForMutation(id: string) {
        return WorkspaceMemberInvitationModel.findById(id)
            .select("_id workspaceId email roleId status expiresAt message updatedAt")
            .lean()
            .exec();
    }

    async findByIdIncludingToken(id: string) {
        return WorkspaceMemberInvitationModel.findById(id)
            .select("+tokenHash")
            .populate([
                {
                    path: "workspaceId",
                    select: "_id name slug",
                },
                {
                    path: "userId",
                    select: "_id email",
                },
                {
                    path: "roleId",
                    select: "_id name displayName code",
                },
                {
                    path: "invitedBy",
                    select: "_id email",
                },
            ])
            .lean()
            .exec();
    }

    async findByTokenHash(tokenHash: string) {
        return WorkspaceMemberInvitationModel.findOne({ tokenHash })
            .populate({ path: "invitedBy", select: "_id email" })
            .lean()
            .exec();
    }

    async expirePendingByTokenHash(tokenHash: string, now: Date) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                tokenHash,
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: {
                    $lte: now,
                },
            },
            {
                $set: {
                    status: WorkspaceInvitationStatus.EXPIRED,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .select("_id status expiresAt")
            .lean()
            .exec();
    }

    async acceptPendingByTokenHash(
        tokenHash: string,
        userId: Types.ObjectId,
        acceptedAt: Date,
        session: ClientSession,
        roleId: string,
    ) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                tokenHash,
                roleId,
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: {
                    $gt: acceptedAt,
                },
            },
            {
                $set: {
                    status: WorkspaceInvitationStatus.ACCEPTED,
                    userId,
                    acceptedAt,
                    updatedBy: userId,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .session(session)
            .select("_id acceptedAt")
            .lean()
            .exec();
    }

    async findPendingByWorkspaceAndEmail(workspaceId: string, email: string) {
        return WorkspaceMemberInvitationModel.findOne({
            workspaceId,
            email: email.trim().toLowerCase(),
            status: WorkspaceInvitationStatus.PENDING,
        })
            .select("_id workspaceId userId email roleId invitedBy status message expiresAt createdAt updatedAt")
            .lean()
            .exec();
    }

    async existsPendingByWorkspaceAndEmail(workspaceId: string, email: string): Promise<boolean> {
        const exists = await WorkspaceMemberInvitationModel.exists({
            workspaceId,
            email: email.trim().toLowerCase(),
            status: WorkspaceInvitationStatus.PENDING,
        });

        return Boolean(exists);
    }

    async findByWorkspaceAndEmail(workspaceId: string, email: string) {
        return WorkspaceMemberInvitationModel.findOne({
            workspaceId,
            email: email.trim().toLowerCase(),
        })
            .sort({
                createdAt: -1,
            })
            .populate([
                {
                    path: "workspaceId",
                    select: "_id name slug",
                },
                {
                    path: "userId",
                    select: "_id email",
                },
                {
                    path: "roleId",
                    select: "_id name displayName code",
                },
                {
                    path: "invitedBy",
                    select: "_id email",
                },
            ])
            .lean()
            .exec();
    }

    async findByWorkspaceAndUser(workspaceId: string, userId: string) {
        return WorkspaceMemberInvitationModel.findOne({
            workspaceId,
            userId,
        })
            .sort({
                createdAt: -1,
            })
            .populate([
                {
                    path: "workspaceId",
                    select: "_id name slug",
                },
                {
                    path: "userId",
                    select: "_id email",
                },
                {
                    path: "roleId",
                    select: "_id name displayName code",
                },
                {
                    path: "invitedBy",
                    select: "_id email",
                },
            ])
            .lean()
            .exec();
    }

    async findAll(filters: IWorkspaceMemberInvitationFilter = {}, workspaceIds: string[] = []) {
        const {
            page = WORKSPACE_MEMBER_INVITATION_CONSTANTS.PAGINATION.DEFAULT_PAGE,
            limit = WORKSPACE_MEMBER_INVITATION_CONSTANTS.PAGINATION.DEFAULT_LIMIT,
            workspaceId,
            userId,
            email,
            roleId,
            invitedBy,
            status,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: Record<string, unknown> = {};

        if (workspaceId) {
            query.workspaceId = workspaceId;
        }

        if (userId) {
            query.userId = userId;
        }

        if (email) {
            const normalizedEmail = email.trim().toLowerCase();

            if (normalizedEmail) {
                query.email = {
                    $regex: `^${this.escapeRegex(normalizedEmail)}`,
                };
            }
        }

        if (roleId) {
            query.roleId = roleId;
        }

        if (invitedBy) {
            query.invitedBy = invitedBy;
        }

        if (status) {
            query.status = status;
        }

        if (!workspaceId) query.workspaceId = { $in: workspaceIds };

        const safePage = Math.max(Number(page) || WORKSPACE_MEMBER_INVITATION_CONSTANTS.PAGINATION.DEFAULT_PAGE, 1);

        const safeLimit = Math.min(
            Math.max(Number(limit) || WORKSPACE_MEMBER_INVITATION_CONSTANTS.PAGINATION.DEFAULT_LIMIT, 1),
            WORKSPACE_MEMBER_INVITATION_CONSTANTS.PAGINATION.MAX_LIMIT,
        );

        const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";

        const safeSortOrder = sortOrder === "asc" ? 1 : -1;

        const { skip } = getPagination(safePage, safeLimit);

        const [data, total] = await Promise.all([
            WorkspaceMemberInvitationModel.find(query)
                .populate(INVITATION_POPULATE)
                .sort({
                    [safeSortBy]: safeSortOrder,
                })
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            WorkspaceMemberInvitationModel.countDocuments(query).exec(),
        ]);

        return {
            data,
            pagination: paginationMeta(safePage, safeLimit, total),
        };
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await WorkspaceMemberInvitationModel.exists({
            _id: id,
        });

        return Boolean(exists);
    }

    async updatePendingById(
        id: string,
        data: Partial<IWorkspaceMemberInvitation>,
        session: ClientSession,
        updatedAt?: Date,
    ) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                _id: id,
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: { $gt: new Date() },
                ...(updatedAt ? { updatedAt } : {}),
            },
            {
                $set: data,
            },
            {
                session,
                new: true,
                runValidators: true,
            },
        )
            .populate(INVITATION_POPULATE.map((option) => ({ ...option, ordered: true })))
            .lean()
            .exec();
    }

    async cancelPendingById(id: string, updatedBy: Types.ObjectId, cancelledAt: Date, session: ClientSession) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                _id: id,
                status: WorkspaceInvitationStatus.PENDING,
                expiresAt: { $gt: new Date() },
            },
            {
                $set: {
                    status: WorkspaceInvitationStatus.CANCELLED,
                    cancelledAt,
                    updatedBy,
                },
            },
            {
                session,
                new: true,
                runValidators: true,
            },
        )
            .populate(INVITATION_POPULATE.map((option) => ({ ...option, ordered: true })))
            .lean()
            .exec();
    }

    async updateStatus(id: string, status: WorkspaceInvitationStatus, data: Partial<IWorkspaceMemberInvitation> = {}) {
        return WorkspaceMemberInvitationModel.findOneAndUpdate(
            {
                _id: id,
            },
            {
                $set: {
                    status,
                    ...data,
                },
            },
            {
                new: true,
                runValidators: true,
            },
        )
            .populate([
                {
                    path: "workspaceId",
                    select: "_id name slug",
                },
                {
                    path: "userId",
                    select: "_id email",
                },
                {
                    path: "roleId",
                    select: "_id name displayName code",
                },
                {
                    path: "invitedBy",
                    select: "_id email",
                },
            ])
            .lean()
            .exec();
    }

    async deleteById(id: string) {
        return WorkspaceMemberInvitationModel.findByIdAndDelete(id).lean().exec();
    }

    private isOnlyDuplicateKeyBulkWriteError(error: unknown): boolean {
        if (!error || typeof error !== "object") {
            return false;
        }

        const record = error as {
            code?: number;
            writeErrors?: unknown;
            result?: {
                getWriteErrors?: () => Array<{ code?: number }>;
            };
        };

        let writeErrors: Array<{ code?: number }> = [];

        if (Array.isArray(record.writeErrors)) {
            writeErrors = record.writeErrors as Array<{ code?: number }>;
        } else if (record.writeErrors instanceof Map) {
            writeErrors = Array.from(record.writeErrors.values()) as Array<{ code?: number }>;
        } else if (typeof record.result?.getWriteErrors === "function") {
            writeErrors = record.result.getWriteErrors();
        }

        if (writeErrors.length > 0) {
            return writeErrors.every((writeError) => writeError.code === 11000);
        }

        return record.code === 11000;
    }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
