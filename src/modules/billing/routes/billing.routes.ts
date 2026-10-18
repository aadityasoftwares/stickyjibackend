import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { requirePermission } from "../../permissions/middlewares/permission.middleware.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { BillingController } from "../controllers/billing.controller.js";

const billingRoutes = Router();
const controller = new BillingController();
const json = validateContentType("application/json");

// Public routes
billingRoutes.get("/plans", controller.getPlans);

// Webhook endpoint (Raw body signature verified, no JWT auth)
billingRoutes.post("/webhooks/razorpay", controller.handleWebhook);

// Authenticated billing routes
billingRoutes.post("/subscribe", authMiddleware, json, controller.subscribe);
billingRoutes.post("/verify", authMiddleware, json, controller.verifyCallback);
billingRoutes.get("/current", authMiddleware, controller.getCurrent);
billingRoutes.post("/cancel", authMiddleware, json, controller.cancel);
billingRoutes.post("/change-plan", authMiddleware, json, controller.changePlan);
billingRoutes.get("/history", authMiddleware, controller.getHistory);

// Admin operations
billingRoutes.post(
    "/admin/reconcile",
    authMiddleware,
    json,
    requirePermission({
        module: PermissionModule.BILLING,
        action: PermissionAction.MANAGE,
        scope: "global",
    }),
    controller.reconcileAsAdmin,
);

export default billingRoutes;
