import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { SubscriptionUsageController } from "../controllers/subscriptionusage.controller.js";
import { getSubscriptionUsageValidation } from "../validations/getSubscriptionUsage.validation.js";
import { getWorkspaceUsageValidation } from "../validations/getWorkspaceUsage.validation.js";
import { getSubscriptionUsageListValidation } from "../validations/getSubscriptionUsageList.validation.js";
import { reconcileSubscriptionUsageValidation } from "../validations/reconcileSubscriptionUsage.validation.js";

const subscriptionUsageRoutes = Router();
const controller = new SubscriptionUsageController();
const json = validateContentType("application/json");
const adminPermission = (action: PermissionAction) =>
    requirePermission({
        module: PermissionModule.SUBSCRIPTION_USAGE,
        action,
        scope: "global",
    });

subscriptionUsageRoutes.use(authMiddleware);

subscriptionUsageRoutes.get(["/me", "/current"], getSubscriptionUsageValidation, controller.getMyUsage);
subscriptionUsageRoutes.get("/summary", getSubscriptionUsageValidation, controller.getSummary);
subscriptionUsageRoutes.get(
    "/workspace/:workspaceId",
    getWorkspaceUsageValidation,
    controller.getWorkspaceUsage,
);

subscriptionUsageRoutes.get(
    "/admin/getall",
    adminPermission(PermissionAction.READ),
    getSubscriptionUsageListValidation,
    controller.getAdminUsageList,
);
subscriptionUsageRoutes.post(
    "/admin/getall",
    json,
    adminPermission(PermissionAction.READ),
    getSubscriptionUsageListValidation,
    controller.getAdminUsageList,
);
subscriptionUsageRoutes.get(
    "/getall",
    adminPermission(PermissionAction.READ),
    getSubscriptionUsageListValidation,
    controller.getAdminUsageList,
);
subscriptionUsageRoutes.post(
    "/getall",
    json,
    adminPermission(PermissionAction.READ),
    getSubscriptionUsageListValidation,
    controller.getAdminUsageList,
);

subscriptionUsageRoutes.post(
    "/admin/reconcile",
    json,
    adminPermission(PermissionAction.MANAGE),
    reconcileSubscriptionUsageValidation,
    controller.reconcileUsage,
);
subscriptionUsageRoutes.post(
    "/reconcile",
    json,
    adminPermission(PermissionAction.MANAGE),
    reconcileSubscriptionUsageValidation,
    controller.reconcileUsage,
);

export default subscriptionUsageRoutes;
