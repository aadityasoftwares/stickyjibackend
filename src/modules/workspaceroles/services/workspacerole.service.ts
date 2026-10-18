import type { IWorkspaceRole } from "../interfaces/workspacerole.interface.js";
import { WorkspaceRoleRepository } from "../repositories/workspacerole.repository.js";
import { generateWorkspaceRoleKey } from "../utils/workspacerolekey.util.js";

export class WorkspaceRoleService {
    private workspaceRoleRepo: WorkspaceRoleRepository;

    constructor() {
        this.workspaceRoleRepo = new WorkspaceRoleRepository();
    }

    async createRole(data: Omit<IWorkspaceRole, "key">) {
        const key = generateWorkspaceRoleKey(data.name); // generate key automatically

        const existing = await this.workspaceRoleRepo.findByKey(key);
        if (existing) throw new Error("Role key already exists");

        const roleData = { ...data, key };
        return await this.workspaceRoleRepo.create(roleData);
    }

    // Update an existing role (do NOT change the key)
    async updateRole(id: string, data: Partial<IWorkspaceRole>) {
        const role = await this.workspaceRoleRepo.findById(id);
        if (!role) throw new Error("Workspace role not found");

        // Prevent key update
        if (data.key) {
            delete data.key;
        }

        return await this.workspaceRoleRepo.update(id, data);
    }

    // Get all roles with optional pagination and search
    async getAllRoles(options: { page?: number; limit?: number; search?: string } = {}) {
        const { page = 1, limit = 10, search = "" } = options;
        return await this.workspaceRoleRepo.findAll(page, limit, search);
    }

    // Get role by ID
    async getRoleById(id: string) {
        const role = await this.workspaceRoleRepo.findById(id);
        if (!role) throw new Error("Workspace role not found");
        return role;
    }

    // Delete a role
    async deleteRole(id: string) {
        const role = await this.workspaceRoleRepo.findById(id);
        if (!role) throw new Error("Workspace role not found");
        return await this.workspaceRoleRepo.delete(id);
    }

    // Deactivate a role
    async deactivateRole(id: string) {
        const role = await this.workspaceRoleRepo.findById(id);
        if (!role) throw new Error("Workspace role not found");
        return await this.workspaceRoleRepo.deactivateRole(id);
    }

    // Activate a role
    async activateRole(id: string) {
        const role = await this.workspaceRoleRepo.findById(id);
        if (!role) throw new Error("Workspace role not found");
        return await this.workspaceRoleRepo.activateRole(id);
    }
}