import type { Request, Response } from "express";
import { WorkspaceRoleService } from "../services/workspacerole.service.js";
import { ResponseUtil } from "../../../utils/response.util.js";

export class WorkspaceRoleController {
    private workspaceRoleService: WorkspaceRoleService;

    constructor() {
        this.workspaceRoleService = new WorkspaceRoleService();
    }

    createRole = async (req: Request, res: Response) => {
        try {
            const role = await this.workspaceRoleService.createRole(req.body);
            return res
                .status(201)
                .json(ResponseUtil.created("Workspace role created successfully", role));
        } catch (error: any) {
            console.error(error);
            return res
                .status(400)
                .json(
                    ResponseUtil.badRequest(typeof error.message === "string" ? error.message : "Bad request")
                );
        }
    };

    getAllRoles = async (req: Request, res: Response) => {
        try {
            const page = parseInt((req.query.page as string) || "1", 10);
            const limit = parseInt((req.query.limit as string) || "10", 10);
            const search = (req.query.search as string) || "";

            const { roles, total } = await this.workspaceRoleService.getAllRoles({ page, limit, search });

            return res
                .status(200)
                .json(ResponseUtil.paginated("Workspace roles fetched successfully", roles, page, limit, total));
        } catch (error: any) {
            console.error(error);
            return res
                .status(500)
                .json(
                    ResponseUtil.serverError(typeof error.message === "string" ? error.message : "Internal server error", error)
                );
        }
    };

    getRoleById = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Role ID is required"));

            const role = await this.workspaceRoleService.getRoleById(id);
            return res.status(200).json(ResponseUtil.success("Workspace role fetched successfully", role));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace role not found"));
        }
    };

    updateRole = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Role ID is required"));

            const updatedRole = await this.workspaceRoleService.updateRole(id, req.body);
            return res.status(200).json(ResponseUtil.success("Workspace role updated successfully", updatedRole));
        } catch (error: any) {
            console.error(error);
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    deleteRole = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Role ID is required"));

            await this.workspaceRoleService.deleteRole(id);
            return res.status(200).json(ResponseUtil.success("Workspace role deleted successfully", {}));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace role not found"));
        }
    };

    deactivateRole = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Role ID is required"));

            const role = await this.workspaceRoleService.deactivateRole(id);
            return res.status(200).json(ResponseUtil.success("Workspace role deactivated successfully", role));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace role not found"));
        }
    };

    activateRole = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Role ID is required"));

            const role = await this.workspaceRoleService.activateRole(id);
            return res.status(200).json(ResponseUtil.success("Workspace role activated successfully", role));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace role not found"));
        }
    };
}