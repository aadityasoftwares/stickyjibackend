import { Router } from "express";
import {
    createWorkspaceRoleSchema,
    updateWorkspaceRoleSchema,
} from "../validations/workspacerole.validation.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";
import { WorkspaceRoleController } from "../controller/workspacerole.controller.js";

const workspaceRoleRoutes = Router();
const controller = new WorkspaceRoleController();

// Create a new workspace role
workspaceRoleRoutes.post("/create", authMiddleware, controller.createRole);

// Get workspace role by ID
workspaceRoleRoutes.get("/get/:id", authMiddleware, controller.getRoleById);

// Get all workspace roles (pagination + search)
workspaceRoleRoutes.get("/getall", authMiddleware, controller.getAllRoles);

// Update workspace role
workspaceRoleRoutes.put(
    "/update/:id",
    authMiddleware,
    validateUsingZOD(updateWorkspaceRoleSchema),
    controller.updateRole,
);

// Delete workspace role
workspaceRoleRoutes.delete("/delete/:id", authMiddleware, controller.deleteRole);

// Deactivate workspace role
workspaceRoleRoutes.put("/deactivate/:id", authMiddleware, controller.deactivateRole);

// Activate workspace role
workspaceRoleRoutes.put("/activate/:id", authMiddleware, controller.activateRole);

export default workspaceRoleRoutes;
