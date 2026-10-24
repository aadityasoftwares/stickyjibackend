import { Types } from "mongoose";
import { RoleModel } from "../models/role.model.js";
import { WorkspaceMemberModel } from "../../workspaceMember/models/workspaceMember.model.js";
import { WorkspaceMemberInvitationModel } from "../../workspaceInvitations/models/workspaceMemberInvitation.model.js";
import { WorkspaceInvitationStatus } from "../../workspaceInvitations/constants/workspaceMemberInvitation.enums.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import type { IRole, IRoleFilter } from "../interfaces/role.interface.js";
import { RoleScope } from "../constants/role.enums.js";

export class RoleRepository {
    async create(data: Partial<IRole>) {
        const role = await RoleModel.create(data);
        return RoleModel.populate(role.toObject(), {
            path: "permissions",
            match: { isActive: true },
            select: "name displayName code module action access sortOrder isSystem isActive",
            options: { lean: true },
        });
    }

    async findById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return RoleModel.findById(id)
            .populate({
                path: "permissions",
                match: { isActive: true },
                select: "name displayName code module action access sortOrder isSystem isActive",
            })
            .lean()
            .exec();
    }

    async findByIdLean(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return RoleModel.findById(id)
            .select(
                "_id name displayName code description type scope workspaceId isSystem isDefault priority isActive permissions createdAt updatedAt",
            )
            .lean()
            .exec();
    }

    async findByCode(code: string, workspaceId?: string | null) {
        const query: Record<string, unknown> = {
            code: code.toUpperCase().trim(),
        };

        if (workspaceId && Types.ObjectId.isValid(workspaceId)) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        } else {
            query.workspaceId = null;
        }

        return RoleModel.findOne(query)
            .populate({
                path: "permissions",
                match: { isActive: true },
                select: "name displayName code module action access sortOrder isSystem isActive",
            })
            .lean()
            .exec();
    }

    async findSystemRoleByCode(code: string) {
        return RoleModel.findOne({
            code: code.toUpperCase().trim(),
            isSystem: true,
        })
            .populate({
                path: "permissions",
                match: { isActive: true },
                select: "name displayName code module action access sortOrder isSystem isActive",
            })
            .lean()
            .exec();
    }

    async findByName(name: string, workspaceId?: string | null) {
        const query: Record<string, unknown> = {
            name: name.toLowerCase().trim(),
        };

        if (workspaceId && Types.ObjectId.isValid(workspaceId)) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        } else {
            query.workspaceId = null;
        }

        return RoleModel.findOne(query).lean().exec();
    }

    async findAll(filters: IRoleFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            type,
            scope,
            workspaceId,
            isActive,
            isSystem,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const andConditions: Record<string, unknown>[] = [];

        if (search) {
            const searchRegex = { $regex: search.trim(), $options: "i" };
            andConditions.push({
                $or: [{ name: searchRegex }, { displayName: searchRegex }, { code: searchRegex }],
            });
        }

        if (workspaceId && Types.ObjectId.isValid(workspaceId)) {
            const wsObjectId = new Types.ObjectId(workspaceId);
            andConditions.push({
                $or: [
                    { workspaceId: wsObjectId },
                    {
                        workspaceId: null,
                        isSystem: true,
                        scope: RoleScope.WORKSPACE,
                    },
                ],
            });
        } else if (!workspaceId) {
            const unavailableIds = await new WorkspaceRepository().findUnavailableIds();
            if (unavailableIds.length > 0) {
                andConditions.push({ workspaceId: { $nin: unavailableIds } });
            }
        }

        if (type) {
            andConditions.push({ type });
        }

        if (scope) {
            andConditions.push({ scope });
        }

        if (isActive !== undefined) {
            andConditions.push({ isActive });
        }

        if (isSystem !== undefined) {
            andConditions.push({ isSystem });
        }

        const query = andConditions.length > 0 ? { $and: andConditions } : {};

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 100);
        const skip = (safePage - 1) * safeLimit;

        const allowedSortFields = new Set([
            "createdAt",
            "updatedAt",
            "name",
            "displayName",
            "code",
            "priority",
            "isActive",
        ]);
        const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";

        const [data, total] = await Promise.all([
            RoleModel.find(query)
                .select(
                    "_id name displayName code description type scope workspaceId isSystem isDefault priority isActive permissions createdAt updatedAt",
                )
                .sort({ [safeSortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            RoleModel.countDocuments(query),
        ]);

        return {
            data,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
            },
        };
    }

    async existsByCode(code: string, workspaceId?: string | null, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = {
            code: code.toUpperCase().trim(),
            workspaceId:
                workspaceId && Types.ObjectId.isValid(workspaceId) ? new Types.ObjectId(workspaceId) : null,
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const exists = await RoleModel.exists(query);
        return !!exists;
    }

    async existsByName(name: string, workspaceId?: string | null, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = {
            name: name.toLowerCase().trim(),
            workspaceId:
                workspaceId && Types.ObjectId.isValid(workspaceId) ? new Types.ObjectId(workspaceId) : null,
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const exists = await RoleModel.exists(query);
        return !!exists;
    }

    async updateById(id: string, data: Partial<IRole>) {
        if (!Types.ObjectId.isValid(id)) return null;
        return RoleModel.findByIdAndUpdate(
            id,
            { $set: data },
            { returnDocument: "after", runValidators: true },
        )
            .populate({
                path: "permissions",
                match: { isActive: true },
                select: "name displayName code module action access sortOrder isSystem isActive",
            })
            .lean()
            .exec();
    }

    async deleteById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return RoleModel.findByIdAndDelete(id).lean().exec();
    }

    async countAssignedMembers(roleId: string): Promise<number> {
        if (!Types.ObjectId.isValid(roleId)) return 0;
        return WorkspaceMemberModel.countDocuments({ roleId: new Types.ObjectId(roleId) });
    }

    async countPendingInvitations(roleId: string): Promise<number> {
        if (!Types.ObjectId.isValid(roleId)) return 0;
        return WorkspaceMemberInvitationModel.countDocuments({
            roleId: new Types.ObjectId(roleId),
            status: WorkspaceInvitationStatus.PENDING,
        });
    }
}
