import { Router } from "express";
import { authMiddleware } from "../../../middlewares/authmiddleware/auth.middleware.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { SubscriptionEntitlementController } from "../controllers/subscriptionentitlement.controller.js";
import { getSubscriptionEntitlementsValidation } from "../validations/getSubscriptionEntitlements.validation.js";
import { checkSubscriptionEntitlementValidation } from "../validations/checkSubscriptionEntitlement.validation.js";

const subscriptionEntitlementRoutes = Router();
const controller = new SubscriptionEntitlementController();

subscriptionEntitlementRoutes.use(authMiddleware);

subscriptionEntitlementRoutes.get("/me", getSubscriptionEntitlementsValidation, controller.getMyEntitlements);

subscriptionEntitlementRoutes.get("/summary", getSubscriptionEntitlementsValidation, controller.getSummary);

subscriptionEntitlementRoutes.post(
    "/check",
    validateContentType("application/json"),
    checkSubscriptionEntitlementValidation,
    controller.checkResourceAvailability,
);

subscriptionEntitlementRoutes.get(
    "/workspace/:workspaceId/folders",
    controller.getWorkspaceFolderEntitlements,
);

export default subscriptionEntitlementRoutes;
