import { Router } from "express";
import { PlanFeatureController } from "../controllers/planfeature.controller.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";
import { changePlanFeatureStatusValidation } from "../validations/changePlanFeatureStatus.validation.js";
import { createPlanFeatureValidation } from "../validations/createPlanFeature.validation.js";
import { deletePlanFeatureValidation } from "../validations/deletePlanFeature.validation.js";
import { getPlanFeatureValidation } from "../validations/getPlanFeature.validation.js";
import { updatePlanFeatureValidation } from "../validations/updatePlanFeature.validation.js";

const planFeatureRoutes = Router();
const planFeatureController = new PlanFeatureController();

planFeatureRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("planId", "featureId", "limitType"),
    createPlanFeatureValidation,
    planFeatureController.createPlanFeature,
);

planFeatureRoutes.get("/getall", planFeatureController.getPlanFeatures);

planFeatureRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getPlanFeatureValidation,
    planFeatureController.getPlanFeatureById,
);

planFeatureRoutes.get(
    "/get/planfeature/:planId/:featureId",
    requireRouteParam("planId"),
    requireRouteParam("featureId"),
    getPlanFeatureValidation,
    planFeatureController.getPlanFeatureByPlanAndFeature,
);

planFeatureRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updatePlanFeatureValidation,
    planFeatureController.updatePlanFeature,
);

planFeatureRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isEnabled"),
    changePlanFeatureStatusValidation,
    planFeatureController.changePlanFeatureStatus,
);

planFeatureRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deletePlanFeatureValidation,
    planFeatureController.deletePlanFeature,
);

export default planFeatureRoutes;
