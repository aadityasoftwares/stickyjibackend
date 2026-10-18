import { Router } from "express";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { WorkspaceFolderController } from "../controllers/workspaceFolder.controller.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { createWorkspaceFolderValidation } from "../validations/createWorkspaceFolder.validation.js";
import { getWorkspaceFolderValidation } from "../validations/getWorkspaceFolder.validation.js";
import { getAllWorkspaceFoldersValidation } from "../validations/getAllWorkspaceFolders.validation.js";
import { getWorkspaceFoldersValidation } from "../validations/getWorkspaceFolders.validation.js";
import { updateWorkspaceFolderValidation } from "../validations/updateWorkspaceFolder.validation.js";
import { updateWorkspaceFolderStatusValidation } from "../validations/updateWorkspaceFolderStatus.validation.js";

const workspaceFolderRoutes = Router();
const workspaceFolderController = new WorkspaceFolderController();
const folderPermission = (action: PermissionAction, resource?: "folder") =>
    requirePermission({
        module: PermissionModule.FOLDERS,
        action,
        resource,
    });

workspaceFolderRoutes.use(authMiddleware);

workspaceFolderRoutes.post(
    "/create",
    validateContentType("application/json"),
    createWorkspaceFolderValidation,
    folderPermission(PermissionAction.CREATE),
    workspaceFolderController.createWorkspaceFolder,
);

workspaceFolderRoutes.get(
    "/get/:id",
    getWorkspaceFolderValidation,
    folderPermission(PermissionAction.READ, "folder"),
    workspaceFolderController.getWorkspaceFolderById,
);

workspaceFolderRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getAllWorkspaceFoldersValidation,
    folderPermission(PermissionAction.READ),
    workspaceFolderController.getWorkspaceFolders,
);

workspaceFolderRoutes.get(
    "/my",
    getWorkspaceFoldersValidation,
    folderPermission(PermissionAction.READ),
    workspaceFolderController.getMyWorkspaceFolders,
);

workspaceFolderRoutes.get(
    "/workspace/:workspaceId",
    getWorkspaceFoldersValidation,
    folderPermission(PermissionAction.READ),
    workspaceFolderController.getWorkspaceFoldersByWorkspace,
);

workspaceFolderRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateWorkspaceFolderValidation,
    folderPermission(PermissionAction.UPDATE, "folder"),
    workspaceFolderController.updateWorkspaceFolder,
);

workspaceFolderRoutes.put(
    "/status/:id",
    validateContentType("application/json"),
    updateWorkspaceFolderStatusValidation,
    folderPermission(PermissionAction.UPDATE, "folder"),
    workspaceFolderController.updateWorkspaceFolderStatus,
);

workspaceFolderRoutes.delete(
    "/delete/:id",
    getWorkspaceFolderValidation,
    folderPermission(PermissionAction.DELETE, "folder"),
    workspaceFolderController.deleteWorkspaceFolder,
);

workspaceFolderRoutes.put(
    "/restore/:id",
    getWorkspaceFolderValidation,
    folderPermission(PermissionAction.UPDATE, "folder"),
    workspaceFolderController.restoreWorkspaceFolder,
);

workspaceFolderRoutes.get(
    ["/", "/getall"],
    getAllWorkspaceFoldersValidation,
    folderPermission(PermissionAction.READ),
    workspaceFolderController.getWorkspaceFolders,
);
workspaceFolderRoutes.put(
    "/trash/:id",
    getWorkspaceFolderValidation,
    folderPermission(PermissionAction.DELETE, "folder"),
    workspaceFolderController.deleteWorkspaceFolder,
);
workspaceFolderRoutes.delete(
    "/permanent/:id",
    getWorkspaceFolderValidation,
    folderPermission(PermissionAction.DELETE, "folder"),
    workspaceFolderController.permanentlyDeleteWorkspaceFolder,
);

export default workspaceFolderRoutes;
