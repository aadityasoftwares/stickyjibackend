import type { IWorkspacePermission } from "../interfaces/workspacepermission.interface.js";
import { WorkspacePermissionRepository } from "../repositories/workspacepermission.repositories.js";
import { generatePermissionKey } from "../utils/workspacepermissionkey.util.js";

export class WorkspacePermissionService {
    private workspacePermissionRepo: WorkspacePermissionRepository;

    constructor() {
        this.workspacePermissionRepo = new WorkspacePermissionRepository();
    }

    async createPermission(data: Omit<IWorkspacePermission, "key">) {

        const key = generatePermissionKey(data.name);


        const existing = await this.workspacePermissionRepo.findByKey(key);
        if (existing) throw new Error("Permission key already exists");


        const permissionData = { ...data, key };

        return await this.workspacePermissionRepo.create(permissionData);
    }

    async updatePermission(id: string, data: Partial<IWorkspacePermission>) {
        const permission = await this.workspacePermissionRepo.findById(id);
        if (!permission) throw new Error("Workspace permission not found");


        // if (data.name) {
        //     const key = generatePermissionKey(data.name);

        //     const existing = await this.workspacePermissionRepo.findByKey(key);
        //     if (existing && existing._id.toString() !== id) {
        //         throw new Error("Permission key already exists");
        //     }

        //     data.key = key; 
        // }

        return await this.workspacePermissionRepo.update(id, data);
    }

    async getAllPermissions(options: { page?: number; limit?: number; search?: string } = {}) {
        const { page = 1, limit = 10, search = "" } = options;
        return await this.workspacePermissionRepo.findAll(page, limit, search);
    }

    async getPermissionById(id: string) {
        const permission = await this.workspacePermissionRepo.findById(id);
        if (!permission) throw new Error("Workspace permission not found");
        return permission;
    }

    async deletePermission(id: string) {
        const permission = await this.workspacePermissionRepo.findById(id);
        if (!permission) throw new Error("Workspace permission not found");
        return await this.workspacePermissionRepo.delete(id);
    }

    async deactivatePermission(id: string) {
        const permission = await this.workspacePermissionRepo.findById(id);
        if (!permission) throw new Error("Workspace permission not found");

        return await this.workspacePermissionRepo.deactivatePermission(id);
    }

    async activatePermission(id: string) {
        const permission = await this.workspacePermissionRepo.findById(id);
        if (!permission) throw new Error("Workspace permission not found");

        return await this.workspacePermissionRepo.activatePermission(id);
    }
}