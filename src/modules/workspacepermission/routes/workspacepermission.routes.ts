import { Router } from "express";
import { WorkspacePermissionController } from "../controllers/workspacepermission.controller.js";
import { createWorkspacePermissionSchema, updateWorkspacePermissionSchema } from "../validations/workspacepermission.validation.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateUsingZOD } from "../../../utils/zodvalidate.util.js";

const workspacePermissionRoutes = Router();
const controller = new WorkspacePermissionController();

workspacePermissionRoutes.post(
    "/create",
    authMiddleware,
    validateUsingZOD(createWorkspacePermissionSchema),
    controller.createPermission
);

workspacePermissionRoutes.get(
    "/get/:id",
    authMiddleware,
    controller.getPermissionById
);

workspacePermissionRoutes.get(
    "/getall",
    authMiddleware,
    controller.getAllPermissions
);

workspacePermissionRoutes.put(
    "/update/:id",
    authMiddleware,
    validateUsingZOD(updateWorkspacePermissionSchema),
    controller.updatePermission
);

workspacePermissionRoutes.delete(
    "/delete/:id",
    authMiddleware,
    controller.deletePermission
);

workspacePermissionRoutes.put(
    "/deactivate/:id",
    authMiddleware,
    controller.deactivatePermission
);

workspacePermissionRoutes.put(
    "/activate/:id",
    authMiddleware,
    controller.activatePermission
);

export default workspacePermissionRoutes;