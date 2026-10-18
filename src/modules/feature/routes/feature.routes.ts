import { Router } from "express";
import { FeatureController } from "../controllers/feature.controller.js";
import { createFeatureValidation } from "../validations/createFeature.validation.js";
import { updateFeatureValidation } from "../validations/updateFeature.validation.js";
import { getFeatureValidation } from "../validations/getFeature.validation.js";
import { changeFeatureStatusValidation } from "../validations/changeFeatureStatus.validation.js";
import { deleteFeatureValidation } from "../validations/deleteFeature.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const featureRoutes = Router();

const featureController = new FeatureController();

featureRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("name", "code", "description", "category"),
    createFeatureValidation,
    featureController.createFeature,
);

featureRoutes.get("/getall", featureController.getFeatures);

featureRoutes.get("/get", getFeatureValidation, featureController.getFeatureById);

featureRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getFeatureValidation,
    featureController.getFeatureById,
);

featureRoutes.get("/get/code", getFeatureValidation, featureController.getFeatureByCode);

featureRoutes.get(
    "/get/code/:code",
    requireRouteParam("code"),
    getFeatureValidation,
    featureController.getFeatureByCode,
);

featureRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateFeatureValidation,
    featureController.updateFeature,
);

featureRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateFeatureValidation,
    featureController.updateFeature,
);

featureRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields("id", "isActive"),
    changeFeatureStatusValidation,
    featureController.changeFeatureStatus,
);

featureRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeFeatureStatusValidation,
    featureController.changeFeatureStatus,
);

featureRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteFeatureValidation,
    featureController.deleteFeature,
);

featureRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteFeatureValidation,
    featureController.deleteFeature,
);

export default featureRoutes;
