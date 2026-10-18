import { WorkspacePermissionModel } from "../models/workspacepermission.model.js";
import type { IWorkspacePermission } from "../interfaces/workspacepermission.interface.js";
import type { Types } from "mongoose";

export class WorkspacePermissionRepository {

    async create(data: Partial<IWorkspacePermission>) {
        return await WorkspacePermissionModel.create(data);
    }


    async findByKey(key: string) {
        return await WorkspacePermissionModel.findOne({ key });
    }


    async findById(id: string) {
        return await WorkspacePermissionModel.findById(id);
    }

    async findAll(
        page = 1,
        limit = 10,
        search = ""
    ) {
        const filter: any = {};

        if (search) {
            filter.$or = [
                { key: { $regex: search, $options: "i" } },
                { name: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (page - 1) * limit;

        const [permissions, total] = await Promise.all([
            WorkspacePermissionModel.find(filter)
                .skip(skip)
                .limit(limit),
            WorkspacePermissionModel.countDocuments(filter),
        ]);

        return { permissions, total };
    }

    async update(id: string, data: Partial<IWorkspacePermission>) {
        return await WorkspacePermissionModel.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id: string) {
        return await WorkspacePermissionModel.findByIdAndDelete(id);
    }

    async deactivatePermission(id: string) {
        return await WorkspacePermissionModel.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );
    }

    async activatePermission(id: string) {
        return await WorkspacePermissionModel.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        );
    }
}