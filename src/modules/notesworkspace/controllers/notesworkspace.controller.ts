import type { Request, Response } from "express";
import { NotesWorkspaceService } from "../services/notesworkspace.service.js";
import { ResponseUtil } from "../../../utils/response.util.js";

export class NotesWorkspaceController {
    private service: NotesWorkspaceService;

    constructor() {
        this.service = new NotesWorkspaceService();
    }

    private getParamValue(value: string | string[] | undefined): string {
        if (Array.isArray(value)) {
            return value[0] || "";
        }

        return typeof value === "string" ? value.trim() : "";
    }

    private getUserId(req: Request): string {
        return req.user?.id?.toString() || "";
    }

    private unauthorized(res: Response) {
        return res.status(401).json(ResponseUtil.unauthorized("User not authenticated"));
    }

    createWorkspace = async (req: Request, res: Response) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const payload = { ...req.body, owner };

            const workspace = await this.service.createWorkspace(payload);

            return res.status(201).json(ResponseUtil.created("Workspace created successfully", workspace));
        } catch (error: any) {
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    getMyWorkspaces = async (req: Request, res: Response) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const workspaces = await this.service.getMyWorkspaces(owner);

            return res.status(200).json(ResponseUtil.success("Workspaces fetched successfully", workspaces));
        } catch (error: any) {
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    getWorkspaceById = async (req: Request, res: Response) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const id = this.getParamValue(req.params.id);

            if (!id) {
                return res.status(400).json(ResponseUtil.badRequest("Workspace ID is required"));
            }

            const workspace = await this.service.getWorkspaceById(id, owner);

            return res.status(200).json(ResponseUtil.success("Workspace fetched successfully", workspace));
        } catch (error: any) {
            return res.status(404).json(ResponseUtil.notFound(error.message || "Workspace not found"));
        }
    };

    updateWorkspace = async (req: Request, res: Response) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const id = this.getParamValue(req.params.id);

            if (!id) {
                return res.status(400).json(ResponseUtil.badRequest("Workspace ID is required"));
            }

            const workspace = await this.service.updateWorkspace(id, owner, req.body);

            return res.status(200).json(ResponseUtil.success("Workspace updated successfully", workspace));
        } catch (error: any) {
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    deleteWorkspace = async (req: Request, res: Response) => {
        return this.handleWorkspaceAction(req, res, "delete");
    };

    deactivateWorkspace = async (req: Request, res: Response) => {
        return this.handleWorkspaceAction(req, res, "deactivate");
    };

    activateWorkspace = async (req: Request, res: Response) => {
        return this.handleWorkspaceAction(req, res, "activate");
    };

    archiveWorkspace = async (req: Request, res: Response) => {
        return this.handleWorkspaceAction(req, res, "archive");
    };

    unarchiveWorkspace = async (req: Request, res: Response) => {
        return this.handleWorkspaceAction(req, res, "unarchive");
    };

    private handleWorkspaceAction = async (
        req: Request,
        res: Response,
        action: "delete" | "activate" | "deactivate" | "archive" | "unarchive",
    ) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const id = this.getParamValue(req.params.id);

            if (!id) {
                return res.status(400).json(ResponseUtil.badRequest("Workspace ID is required"));
            }

            let data: any = {};
            let message = "";

            switch (action) {
                case "delete":
                    await this.service.deleteWorkspace(id, owner);

                    message = "Workspace deleted successfully";
                    break;

                case "activate":
                    data = await this.service.activateWorkspace(id, owner);

                    message = "Workspace activated successfully";
                    break;

                case "deactivate":
                    data = await this.service.deactivateWorkspace(id, owner);

                    message = "Workspace deactivated successfully";
                    break;

                case "archive":
                    data = await this.service.archiveWorkspace(id, owner);

                    message = "Workspace archived successfully";
                    break;

                case "unarchive":
                    data = await this.service.unarchiveWorkspace(id, owner);

                    message = "Workspace unarchived successfully";
                    break;
            }

            return res.status(200).json(ResponseUtil.success(message, data));
        } catch (error: any) {
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };

    filterMyWorkspaces = async (req: Request, res: Response) => {
        try {
            const owner = this.getUserId(req);

            if (!owner) {
                return this.unauthorized(res);
            }

            const result = await this.service.filterMyWorkspaces(owner, req.body);

            return res.status(200).json({
                success: true,
                message: "Workspaces filtered successfully",
                data: result.workspaces,
                pagination: result.pagination,
            });
        } catch (error: any) {
            return res.status(400).json(ResponseUtil.badRequest(error.message || "Bad request"));
        }
    };
}
