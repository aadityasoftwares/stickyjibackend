import { Router } from "express";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";

import { WorkspaceMemberInvitationController } from "../controllers/workspaceMemberInvitation.controller.js";

import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

import { createWorkspaceMemberInvitationValidation } from "../validations/createWorkspaceMemberInvitation.validation.js";
import { getWorkspaceMemberInvitationValidation } from "../validations/getWorkspaceMemberInvitation.validation.js";
import { updateWorkspaceMemberInvitationValidation } from "../validations/updateWorkspaceMemberInvitation.validation.js";
import { getAllWorkspaceMemberInvitationsValidation } from "../validations/getAllWorkspaceMemberInvitations.validation.js";
import {
    validateWorkspaceMemberInvitationTokenValidation,
    acceptWorkspaceMemberInvitationValidation,
} from "../validations/acceptWorkspaceMemberInvitation.validation.js";

const workspaceMemberInvitationRoutes = Router();

const workspaceMemberInvitationController = new WorkspaceMemberInvitationController();
const invitationPermission = (action: PermissionAction, resource?: "invitation") =>
    requirePermission({
        module: PermissionModule.MEMBERS,
        action,
        ...(resource ? { resource } : {}),
    });

workspaceMemberInvitationRoutes.post(
    "/create",
    authMiddleware,
    validateContentType("application/json"),
    createWorkspaceMemberInvitationValidation,
    invitationPermission(PermissionAction.INVITE),
    workspaceMemberInvitationController.createInvitation,
);

/**
 * PUBLIC.
 * Used when the invitation page first opens, before login/signup.
 */
workspaceMemberInvitationRoutes.post(
    "/validatetoken",
    validateContentType("application/json"),
    validateWorkspaceMemberInvitationTokenValidation,
    workspaceMemberInvitationController.validateInvitationToken,
);

/**
 * AUTHENTICATED.
 * Converts a valid pending invitation into active workspace membership.
 */
workspaceMemberInvitationRoutes.post(
    "/accept",
    authMiddleware,
    validateContentType("application/json"),
    acceptWorkspaceMemberInvitationValidation,
    workspaceMemberInvitationController.acceptInvitation,
);

workspaceMemberInvitationRoutes.get(
    "/get/:id",
    authMiddleware,
    getWorkspaceMemberInvitationValidation,
    invitationPermission(PermissionAction.READ, "invitation"),
    workspaceMemberInvitationController.getInvitationById,
);

workspaceMemberInvitationRoutes.post(
    "/getall",
    authMiddleware,
    validateContentType("application/json"),
    getAllWorkspaceMemberInvitationsValidation,
    invitationPermission(PermissionAction.READ),
    workspaceMemberInvitationController.getInvitations,
);

workspaceMemberInvitationRoutes.get(
    ["/", "/getall"],
    authMiddleware,
    getAllWorkspaceMemberInvitationsValidation,
    invitationPermission(PermissionAction.READ),
    workspaceMemberInvitationController.getInvitations,
);

workspaceMemberInvitationRoutes.put(
    "/update/:id",
    authMiddleware,
    validateContentType("application/json"),
    updateWorkspaceMemberInvitationValidation,
    invitationPermission(PermissionAction.ASSIGN, "invitation"),
    workspaceMemberInvitationController.updateInvitation,
);

workspaceMemberInvitationRoutes.put(
    "/cancel/:id",
    authMiddleware,
    getWorkspaceMemberInvitationValidation,
    invitationPermission(PermissionAction.REMOVE, "invitation"),
    workspaceMemberInvitationController.cancelInvitation,
);

workspaceMemberInvitationRoutes.delete(
    ["/delete/:id", "/cancel/:id"],
    authMiddleware,
    getWorkspaceMemberInvitationValidation,
    invitationPermission(PermissionAction.REMOVE, "invitation"),
    workspaceMemberInvitationController.cancelInvitation,
);

export default workspaceMemberInvitationRoutes;
