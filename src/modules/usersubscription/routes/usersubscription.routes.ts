import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { UserSubscriptionController } from "../controllers/usersubscription.controller.js";
import { getUserSubscriptionValidation } from "../validations/getUserSubscription.validation.js";
import {
    getAdminSubscriptionsValidation,
    getUserSubscriptionsValidation,
} from "../validations/getUserSubscriptions.validation.js";
import { changeSubscriptionPlanValidation } from "../validations/changeSubscriptionPlan.validation.js";
import {
    cancelSubscriptionValidation,
    undoSubscriptionCancellationValidation,
} from "../validations/cancelSubscription.validation.js";
import { reconcileSubscriptionsValidation } from "../validations/reconcileSubscriptions.validation.js";

const userSubscriptionRoutes = Router();
const controller = new UserSubscriptionController();
const json = validateContentType("application/json");
const adminPermission = (action: PermissionAction) =>
    requirePermission({
        module: PermissionModule.USER_SUBSCRIPTION,
        action,
        scope: "global",
    });

userSubscriptionRoutes.use(authMiddleware);

userSubscriptionRoutes.get(["/current", "/active"], controller.getCurrentSubscription);
userSubscriptionRoutes.get("/status", controller.getSubscriptionStatus);
userSubscriptionRoutes.get("/get/:id", getUserSubscriptionValidation, controller.getSubscriptionById);
userSubscriptionRoutes.get(
    ["/", "/getall", "/history", "/my"],
    getUserSubscriptionsValidation,
    controller.getUserSubscriptions,
);
userSubscriptionRoutes.post("/getall", json, getUserSubscriptionsValidation, controller.getUserSubscriptions);

userSubscriptionRoutes.post(
    ["/create", "/change-plan"],
    json,
    changeSubscriptionPlanValidation,
    controller.requestPlanChange,
);
userSubscriptionRoutes.put(
    "/change-plan",
    json,
    changeSubscriptionPlanValidation,
    controller.requestPlanChange,
);
userSubscriptionRoutes.post("/cancel", json, cancelSubscriptionValidation, controller.requestCancellation);
userSubscriptionRoutes.put("/cancel", json, cancelSubscriptionValidation, controller.requestCancellation);
userSubscriptionRoutes.post(
    "/undo-cancel",
    json,
    undoSubscriptionCancellationValidation,
    controller.undoScheduledCancellation,
);
userSubscriptionRoutes.put(
    "/undo-cancel",
    json,
    undoSubscriptionCancellationValidation,
    controller.undoScheduledCancellation,
);

userSubscriptionRoutes.get(
    "/admin/getall",
    adminPermission(PermissionAction.READ),
    getAdminSubscriptionsValidation,
    controller.getAdminSubscriptions,
);
userSubscriptionRoutes.post(
    "/admin/getall",
    json,
    adminPermission(PermissionAction.READ),
    getAdminSubscriptionsValidation,
    controller.getAdminSubscriptions,
);
userSubscriptionRoutes.get(
    "/admin/get/:id",
    getUserSubscriptionValidation,
    adminPermission(PermissionAction.READ),
    controller.getAdminSubscriptionById,
);
userSubscriptionRoutes.post(
    "/admin/reconcile",
    json,
    adminPermission(PermissionAction.MANAGE),
    reconcileSubscriptionsValidation,
    controller.reconcileSubscriptions,
);

export default userSubscriptionRoutes;
