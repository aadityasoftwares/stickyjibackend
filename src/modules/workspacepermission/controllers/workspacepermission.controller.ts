import type { Request, Response } from "express";
import { WorkspacePermissionService } from "../services/workspacepermission.service.js";
import { ResponseUtil } from "../../../utils/response.util.js";

export class WorkspacePermissionController {
    private workspacePermissionService: WorkspacePermissionService;

    constructor() {
        this.workspacePermissionService = new WorkspacePermissionService();
    }

    createPermission = async (req: Request, res: Response) => {
        try {
            const permission = await this.workspacePermissionService.createPermission(req.body);
            return res
                .status(201)
                .json(ResponseUtil.created("Workspace permission created successfully", permission));
        } catch (error: any) {
            console.error(error);
            return res
                .status(400)
                .json(
                    ResponseUtil.badRequest(typeof error.message === "string" ? error.message : "Bad request")
                );
        }
    };

    getAllPermissions = async (req: Request, res: Response) => {
        try {
            const page = parseInt((req.query.page as string) || "1", 10);
            const limit = parseInt((req.query.limit as string) || "10", 10);
            const search = (req.query.search as string) || "";

            const { permissions, total } = await this.workspacePermissionService.getAllPermissions({
                page,
                limit,
                search,
            });

            return res
                .status(200)
                .json(ResponseUtil.paginated("Workspace permissions fetched successfully", permissions, page, limit, total));
        } catch (error: any) {
            console.error(error);
            return res
                .status(500)
                .json(
                    ResponseUtil.serverError(typeof error.message === "string" ? error.message : "Internal server error", error)
                );
        }
    };

    getPermissionById = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Permission ID is required"));

            const permission = await this.workspacePermissionService.getPermissionById(id);
            return res.status(200).json(ResponseUtil.success("Workspace permission fetched successfully", permission));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace permission not found"));
        }
    };

    updatePermission = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Permission ID is required"));

            const updatedPermission = await this.workspacePermissionService.updatePermission(id, req.body);
            return res.status(200).json(ResponseUtil.success("Workspace permission updated successfully", updatedPermission));
        } catch (error: any) {
            console.error(error);
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    deletePermission = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Permission ID is required"));

            await this.workspacePermissionService.deletePermission(id);
            return res.status(200).json(ResponseUtil.success("Workspace permission deleted successfully", {}));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace permission not found"));
        }
    };

    deactivatePermission = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Permission ID is required"));

            const permission = await this.workspacePermissionService.deactivatePermission(id);
            return res.status(200).json(ResponseUtil.success("Workspace permission deactivated successfully", permission));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace permission not found"));
        }
    };

    activatePermission = async (req: Request, res: Response) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!id) return res.status(400).json(ResponseUtil.badRequest("Permission ID is required"));

            const permission = await this.workspacePermissionService.activatePermission(id);
            return res.status(200).json(ResponseUtil.success("Workspace permission activated successfully", permission));
        } catch (error: any) {
            console.error(error);
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace permission not found"));
        }
    };
}