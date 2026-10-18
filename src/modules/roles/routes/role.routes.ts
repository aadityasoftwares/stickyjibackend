import { Router } from "express";
import { RoleController } from "../controllers/role.controller.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { createRoleValidation } from "../validations/createRole.validation.js";
import { updateRoleValidation } from "../validations/updateRole.validation.js";
import { getRoleValidation } from "../validations/getRole.validation.js";
import { getRolesValidation } from "../validations/getRoles.validation.js";
import { changeRoleStatusValidation } from "../validations/changeRoleStatus.validation.js";
import { deleteRoleValidation } from "../validations/deleteRole.validation.js";

const roleRoutes = Router();
const roleController = new RoleController();

const rolePermission = (action: PermissionAction | PermissionAction[], resource?: "role") =>
    requirePermission({
        module: PermissionModule.ROLES,
        action,
        ...(resource ? { resource } : {}),
    });

roleRoutes.use(authMiddleware);

roleRoutes.post(
    "/create",
    validateContentType("application/json"),
    createRoleValidation,
    rolePermission(PermissionAction.CREATE),
    roleController.createRole,
);

roleRoutes.post(
    ["/", "/getall"],
    validateContentType("application/json"),
    getRolesValidation,
    rolePermission(PermissionAction.READ),
    roleController.getRoles,
);

roleRoutes.get(
    ["/", "/getall"],
    getRolesValidation,
    rolePermission(PermissionAction.READ),
    roleController.getRoles,
);

roleRoutes.get(
    "/get",
    getRoleValidation,
    rolePermission(PermissionAction.READ, "role"),
    roleController.getRoleById,
);

roleRoutes.get(
    "/get/:id",
    getRoleValidation,
    rolePermission(PermissionAction.READ, "role"),
    roleController.getRoleById,
);

roleRoutes.get(
    "/get/code",
    getRoleValidation,
    rolePermission(PermissionAction.READ),
    roleController.getRoleByCode,
);

roleRoutes.get(
    "/get/code/:code",
    getRoleValidation,
    rolePermission(PermissionAction.READ),
    roleController.getRoleByCode,
);

roleRoutes.put(
    "/update",
    validateContentType("application/json"),
    updateRoleValidation,
    rolePermission(PermissionAction.UPDATE, "role"),
    roleController.updateRole,
);

roleRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateRoleValidation,
    rolePermission(PermissionAction.UPDATE, "role"),
    roleController.updateRole,
);

roleRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    changeRoleStatusValidation,
    rolePermission(PermissionAction.UPDATE, "role"),
    roleController.changeRoleStatus,
);

roleRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    changeRoleStatusValidation,
    rolePermission(PermissionAction.UPDATE, "role"),
    roleController.changeRoleStatus,
);

roleRoutes.delete(
    "/delete",
    deleteRoleValidation,
    rolePermission(PermissionAction.DELETE, "role"),
    roleController.deleteRole,
);

roleRoutes.delete(
    "/delete/:id",
    deleteRoleValidation,
    rolePermission(PermissionAction.DELETE, "role"),
    roleController.deleteRole,
);

export default roleRoutes;
