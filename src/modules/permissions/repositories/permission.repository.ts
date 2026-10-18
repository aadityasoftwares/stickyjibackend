import { Types } from "mongoose";
import { PermissionModel } from "../models/permission.model.js";
import { UserModel } from "../../user/models/user.model.js";
import { UserStatus } from "../../user/constants/user.enums.js";
import { RoleModel } from "../../roles/models/role.model.js";
import { RoleScope } from "../../roles/constants/role.enums.js";
import type {
    IPermission,
    IPermissionDocument,
    IPermissionFilter,
} from "../interfaces/permission.interface.js";
import type { PermissionAccess, PermissionAction } from "../constants/permission.enums.js";

const PERMISSION_SELECT_FIELDS =
    "_id name displayName code module action access description sortOrder isSystem isActive createdAt updatedAt";

export class PermissionRepository {
    async findUserGlobalRole(userId: string) {
        if (!Types.ObjectId.isValid(userId)) return null;
        const user = await UserModel.findOne({
            _id: new Types.ObjectId(userId),
            status: UserStatus.ACTIVE,
            isDeleted: { $ne: true },
        })
            .select("globalRoleId")
            .lean()
            .exec();

        if (!user?.globalRoleId) return null;

        return RoleModel.findOne({
            _id: user.globalRoleId,
            scope: RoleScope.GLOBAL,
            workspaceId: null,
            isActive: true,
        })
            .populate<{ permissions: IPermissionDocument[] }>({
                path: "permissions",
                match: { isActive: true },
                select: "module action access code isActive",
            })
            .select("permissions")
            .lean()
            .exec();
    }

    async create(data: Partial<IPermission>) {
        const permission = await PermissionModel.create(data);
        return PermissionModel.findById(permission._id).select(PERMISSION_SELECT_FIELDS).lean().exec();
    }

    async findById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return PermissionModel.findById(id).select(PERMISSION_SELECT_FIELDS).lean().exec();
    }

    async findByCode(code: string) {
        return PermissionModel.findOne({
            code: code.toUpperCase().trim(),
        })
            .select(PERMISSION_SELECT_FIELDS)
            .lean()
            .exec();
    }

    async findByName(name: string) {
        return PermissionModel.findOne({
            name: name.toLowerCase().trim(),
        })
            .select(PERMISSION_SELECT_FIELDS)
            .lean()
            .exec();
    }

    async findByCombination(module: string, action: PermissionAction, access: PermissionAccess) {
        return PermissionModel.findOne({
            module: module.toUpperCase().trim(),
            action,
            access,
        })
            .select(PERMISSION_SELECT_FIELDS)
            .lean()
            .exec();
    }

    async findAll(filters: IPermissionFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            module,
            action,
            access,
            isSystem,
            isActive,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const andConditions: Record<string, unknown>[] = [];

        if (search) {
            const searchRegex = { $regex: search.trim(), $options: "i" };
            andConditions.push({
                $or: [
                    { name: searchRegex },
                    { displayName: searchRegex },
                    { code: searchRegex },
                    { module: searchRegex },
                ],
            });
        }

        if (module) {
            andConditions.push({ module: module.toUpperCase().trim() });
        }

        if (action) {
            andConditions.push({ action });
        }

        if (access) {
            andConditions.push({ access });
        }

        if (isSystem !== undefined) {
            andConditions.push({ isSystem });
        }

        if (isActive !== undefined) {
            andConditions.push({ isActive });
        }

        const query = andConditions.length > 0 ? { $and: andConditions } : {};

        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(Math.max(1, Number(limit) || 10), 100);
        const skip = (safePage - 1) * safeLimit;

        const allowedSortFields = new Set([
            "createdAt",
            "updatedAt",
            "displayName",
            "code",
            "module",
            "action",
            "access",
            "sortOrder",
            "isActive",
        ]);

        const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "createdAt";

        const [data, total] = await Promise.all([
            PermissionModel.find(query)
                .select(PERMISSION_SELECT_FIELDS)
                .sort({ [safeSortBy]: sortOrder === "asc" ? 1 : -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            PermissionModel.countDocuments(query),
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

    async findForRoleBuilder() {
        return PermissionModel.find({ isActive: true })
            .select(PERMISSION_SELECT_FIELDS)
            .sort({
                module: 1,
                sortOrder: 1,
                displayName: 1,
            })
            .lean()
            .exec();
    }

    async existsByCode(code: string, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = {
            code: code.toUpperCase().trim(),
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const exists = await PermissionModel.exists(query);
        return !!exists;
    }

    async existsByName(name: string, excludeId?: string): Promise<boolean> {
        const query: Record<string, unknown> = {
            name: name.toLowerCase().trim(),
        };
        if (excludeId && Types.ObjectId.isValid(excludeId)) {
            query._id = { $ne: new Types.ObjectId(excludeId) };
        }
        const exists = await PermissionModel.exists(query);
        return !!exists;
    }

    async updateById(id: string, data: Partial<IPermission>) {
        if (!Types.ObjectId.isValid(id)) return null;
        return PermissionModel.findByIdAndUpdate(
            id,
            { $set: data },
            { returnDocument: "after", runValidators: true },
        )
            .select(PERMISSION_SELECT_FIELDS)
            .lean()
            .exec();
    }

    async deleteById(id: string) {
        if (!Types.ObjectId.isValid(id)) return null;
        return PermissionModel.findByIdAndDelete(id).lean().exec();
    }
}
