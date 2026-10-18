import { Router } from "express";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { WorkspaceMemberController } from "../controllers/workspaceMember.controller.js";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { createWorkspaceMemberValidation } from "../validations/createWorkspaceMember.validation.js";
import { getWorkspaceMemberValidation } from "../validations/getWorkspaceMember.validation.js";
import { getWorkspaceMembersValidation } from "../validations/getWorkspaceMembers.validation.js";
import { updateWorkspaceMemberValidation } from "../validations/updateWorkspaceMember.validation.js";

const workspaceMemberRoutes = Router();
const workspaceMemberController = new WorkspaceMemberController();
const workspaceMemberPermission = (
    action: PermissionAction | PermissionAction[],
    resource?: "member",
    allowTrashedWorkspace = false,
    allowInactiveWorkspace = false,
) =>
    requirePermission({
        module: PermissionModule.MEMBERS,
        action,
        resource,
        allowTrashedWorkspace,
        allowInactiveWorkspace,
    });
const memberPermission = workspaceMemberPermission;

workspaceMemberRoutes.use(authMiddleware);

workspaceMemberRoutes.post(
    "/create",
    validateContentType("application/json"),
    createWorkspaceMemberValidation,
    workspaceMemberPermission(PermissionAction.INVITE),
    workspaceMemberController.createWorkspaceMember,
);

workspaceMemberRoutes.get(
    "/get/:id",
    getWorkspaceMemberValidation,
    workspaceMemberPermission(PermissionAction.READ, "member"),
    workspaceMemberController.getWorkspaceMemberById,
);

workspaceMemberRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getWorkspaceMembersValidation,
    workspaceMemberPermission(PermissionAction.READ),
    workspaceMemberController.getWorkspaceMembers,
);

workspaceMemberRoutes.get(
    ["/", "/getall"],
    getWorkspaceMembersValidation,
    workspaceMemberPermission(PermissionAction.READ),
    workspaceMemberController.getWorkspaceMembers,
);

workspaceMemberRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    updateWorkspaceMemberValidation,
    memberPermission(PermissionAction.ASSIGN, "member"),
    workspaceMemberController.updateWorkspaceMember,
);

workspaceMemberRoutes.put(
    "/role/:id",
    validateContentType("application/json"),
    updateWorkspaceMemberValidation,
    memberPermission(PermissionAction.ASSIGN, "member"),
    workspaceMemberController.assignRole,
);

workspaceMemberRoutes.delete(
    "/delete/:id",
    getWorkspaceMemberValidation,
    memberPermission(PermissionAction.REMOVE, "member"),
    workspaceMemberController.removeWorkspaceMember,
);

workspaceMemberRoutes.put(
    "/restore/:id",
    getWorkspaceMemberValidation,
    memberPermission([PermissionAction.INVITE, PermissionAction.ASSIGN], "member"),
    workspaceMemberController.restoreWorkspaceMember,
);

export default workspaceMemberRoutes;
