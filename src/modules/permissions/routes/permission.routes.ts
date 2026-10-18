import { Router } from "express";
import { PermissionController } from "../controllers/permission.controller.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../constants/permission.enums.js";
import { createPermissionValidation } from "../validations/createPermission.validation.js";
import { updatePermissionValidation } from "../validations/updatePermission.validation.js";
import { getPermissionValidation } from "../validations/getPermission.validation.js";
import { getPermissionsValidation } from "../validations/getPermissions.validation.js";
import { changePermissionStatusValidation } from "../validations/changePermissionStatus.validation.js";
import { deletePermissionValidation } from "../validations/deletePermission.validation.js";

const permissionRoutes = Router();
const permissionController = new PermissionController();

permissionRoutes.use(authMiddleware);

permissionRoutes.get("/grouped", permissionController.getGroupedPermissions);

permissionRoutes.post(
    ["/", "/getall"],
    validateContentType("application/json"),
    getPermissionsValidation,
    permissionController.getPermissions,
);

permissionRoutes.get(["/", "/getall"], getPermissionsValidation, permissionController.getPermissions);

permissionRoutes.get("/get", getPermissionValidation, permissionController.getPermissionById);

permissionRoutes.get("/get/:id", getPermissionValidation, permissionController.getPermissionById);

permissionRoutes.get("/get/code", getPermissionValidation, permissionController.getPermissionByCode);

permissionRoutes.get("/get/code/:code", getPermissionValidation, permissionController.getPermissionByCode);

permissionRoutes.post(
    "/create",
    validateContentType("application/json"),
    createPermissionValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.CREATE, scope: "global" }),
    permissionController.createPermission,
);

permissionRoutes.put(
    "/update",
    validateContentType("application/json"),
    updatePermissionValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.UPDATE, scope: "global" }),
    permissionController.updatePermission,
);

permissionRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updatePermissionValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.UPDATE, scope: "global" }),
    permissionController.updatePermission,
);

permissionRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    changePermissionStatusValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.UPDATE, scope: "global" }),
    permissionController.changePermissionStatus,
);

permissionRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    changePermissionStatusValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.UPDATE, scope: "global" }),
    permissionController.changePermissionStatus,
);

permissionRoutes.delete(
    "/delete",
    deletePermissionValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.DELETE, scope: "global" }),
    permissionController.deletePermission,
);

permissionRoutes.delete(
    "/delete/:id",
    deletePermissionValidation,
    requirePermission({ module: PermissionModule.ROLES, action: PermissionAction.DELETE, scope: "global" }),
    permissionController.deletePermission,
);

export default permissionRoutes;
