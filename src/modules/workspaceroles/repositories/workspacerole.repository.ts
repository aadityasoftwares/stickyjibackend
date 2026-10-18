import type { IWorkspaceRole } from "../interfaces/workspacerole.interface.js";
import { WorkspaceRoleModel } from "../models/workspacerole.model.js";

export class WorkspaceRoleRepository {

    async create(data: Partial<IWorkspaceRole>) {
        return await WorkspaceRoleModel.create(data);
    }

    async findByKey(key: string) {
        return await WorkspaceRoleModel.findOne({ key }).populate("permissions");
    }

    async findById(id: string) {
        return await WorkspaceRoleModel.findById(id).populate("permissions");
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

        const [roles, total] = await Promise.all([
            WorkspaceRoleModel.find(filter)
                .populate("permissions")
                .skip(skip)
                .limit(limit),
            WorkspaceRoleModel.countDocuments(filter),
        ]);

        return { roles, total };
    }

    async update(id: string, data: Partial<IWorkspaceRole>) {
        return await WorkspaceRoleModel.findByIdAndUpdate(id, data, { new: true }).populate("permissions");
    }

    async delete(id: string) {
        return await WorkspaceRoleModel.findByIdAndDelete(id);
    }

    async deactivateRole(id: string) {
        return await WorkspaceRoleModel.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        ).populate("permissions");
    }

    async activateRole(id: string) {
        return await WorkspaceRoleModel.findByIdAndUpdate(
            id,
            { isActive: true },
            { new: true }
        ).populate("permissions");
    }
}