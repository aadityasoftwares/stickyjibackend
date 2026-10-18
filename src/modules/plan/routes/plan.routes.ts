import { Router } from "express";
import { PlanController } from "../controllers/plan.controller.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { optionalAuthMiddleware } from "../../../middlewares/authmiddleware/optionalAuth.middleware.js";
import { createPlanValidation } from "../validations/createPlan.validation.js";
import { getAllPlansValidation } from "../validations/getAllPlans.validation.js";
import { getPlanValidation } from "../validations/getPlan.validation.js";
import { updatePlanValidation } from "../validations/updatePlan.validation.js";
import { updatePlanStatusValidation } from "../validations/updatePlanStatus.validation.js";
import { deletePlanValidation } from "../validations/deletePlan.validation.js";

const planRoutes = Router();
const planController = new PlanController();

// Dedicated Subscription Plans / Pricing Catalog endpoint
planRoutes.get("/subscriptionplans", optionalAuthMiddleware, planController.getSubscriptionPlans);
planRoutes.get("/pricing", optionalAuthMiddleware, planController.getSubscriptionPlans);
planRoutes.post("/subscriptionplans", optionalAuthMiddleware, planController.getSubscriptionPlans);

planRoutes.post(
    "/create",
    validateContentType("application/json"),
    createPlanValidation,
    planController.createPlan,
);

planRoutes.get("/get/:id", getPlanValidation, planController.getPlanById);
planRoutes.get("/get", getPlanValidation, planController.getPlanById);
planRoutes.get("/get/code/:code", getPlanValidation, planController.getPlanByCode);
planRoutes.get("/get/code", getPlanValidation, planController.getPlanByCode);

planRoutes.post(
    "/getall",
    validateContentType("application/json"),
    getAllPlansValidation,
    planController.getPlans,
);

planRoutes.get(["/", "/getall"], getAllPlansValidation, planController.getPlans);

planRoutes.put(
    ["/update/:id", "/update"],
    validateContentType("application/json"),
    updatePlanValidation,
    planController.updatePlan,
);

planRoutes.put(
    ["/status/:id", "/status"],
    validateContentType("application/json"),
    updatePlanStatusValidation,
    planController.updatePlanStatus,
);

planRoutes.patch(
    ["/update/:id/status", "/update/status"],
    validateContentType("application/json"),
    updatePlanStatusValidation,
    planController.updatePlanStatus,
);

planRoutes.delete(["/delete/:id", "/delete"], deletePlanValidation, planController.deletePlan);

export default planRoutes;
