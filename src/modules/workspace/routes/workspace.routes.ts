import { Router } from "express";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { WorkspaceController } from "../controllers/workspace.controller.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { createWorkspaceValidation } from "../validations/createWorkspace.validation.js";
import { getWorkspaceValidation } from "../validations/getWorkspace.validation.js";
import { getWorkspacesValidation } from "../validations/getWorkspaces.validation.js";
import { updateWorkspaceValidation } from "../validations/updateWorkspace.validation.js";
import { updateWorkspaceStatusValidation } from "../validations/updateWorkspaceStatus.validation.js";
import { getAllWorkspacesValidation } from "../validations/getAllWorkspaces.validation.js";

const workspaceRoutes = Router();
const workspaceController = new WorkspaceController();
const workspacePermission = (
    action: PermissionAction | PermissionAction[],
    allowTrashedWorkspace = false,
    allowInactiveWorkspace = false,
) =>
    requirePermission({
        module: PermissionModule.WORKSPACE,
        action,
        resource: "workspace",
        allowTrashedWorkspace,
        allowInactiveWorkspace,
    });

workspaceRoutes.use(authMiddleware);

workspaceRoutes.post(
    "/create",
    validateContentType("application/json"),
    createWorkspaceValidation,
    requirePermission({
        module: PermissionModule.WORKSPACE,
        action: PermissionAction.CREATE,
        scope: "global",
    }),
    workspaceController.createWorkspace,
);

workspaceRoutes.get(
    "/get/:id",
    getWorkspaceValidation,
    workspacePermission(PermissionAction.READ, true, true),
    workspaceController.getWorkspaceById,
);

workspaceRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getAllWorkspacesValidation,
    workspaceController.getWorkspaces,
);

workspaceRoutes.get(["/", "/getall"], getAllWorkspacesValidation, workspaceController.getWorkspaces);

workspaceRoutes.get("/my", getWorkspacesValidation, workspaceController.getMyWorkspaces);

workspaceRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateWorkspaceValidation,
    workspacePermission(PermissionAction.UPDATE),
    workspaceController.updateWorkspace,
);

workspaceRoutes.put(
    "/status/:id",
    validateContentType("application/json"),
    updateWorkspaceStatusValidation,
    workspacePermission(PermissionAction.UPDATE, false, true),
    workspaceController.updateWorkspaceStatus,
);

workspaceRoutes.put(
    "/trash/:id",
    getWorkspaceValidation,
    workspacePermission(PermissionAction.DELETE, true),
    workspaceController.deleteWorkspace,
);
workspaceRoutes.delete(
    "/delete/:id",
    getWorkspaceValidation,
    workspacePermission(PermissionAction.DELETE, true),
    workspaceController.deleteWorkspace,
);

workspaceRoutes.put(
    "/restore/:id",
    getWorkspaceValidation,
    workspacePermission(PermissionAction.UPDATE, true),
    workspaceController.restoreWorkspace,
);
workspaceRoutes.delete(
    "/permanent/:id",
    getWorkspaceValidation,
    workspacePermission(PermissionAction.DELETE, true),
    workspaceController.permanentlyDeleteWorkspace,
);

export default workspaceRoutes;
