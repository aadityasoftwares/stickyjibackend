import { Router } from "express";
import { LocalizationController } from "../controllers/localization.controller.js";
import { createLocalizationValidation } from "../validations/createLocalization.validation.js";
import { updateLocalizationValidation } from "../validations/updateLocalization.validation.js";
import { getLocalizationValidation } from "../validations/getLocalization.validation.js";
import { changeLocalizationStatusValidation } from "../validations/changeLocalizationStatus.validation.js";
import { deleteLocalizationValidation } from "../validations/deleteLocalization.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const localizationRoutes = Router();
const localizationController = new LocalizationController();

localizationRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("language", "languageCode", "locale", "key", "value", "module"),
    createLocalizationValidation,
    localizationController.createLocalization,
);

localizationRoutes.get("/getall", localizationController.getLocalizations);

localizationRoutes.get("/get", getLocalizationValidation, localizationController.getLocalizationById);

localizationRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getLocalizationValidation,
    localizationController.getLocalizationById,
);

localizationRoutes.get("/get/key", getLocalizationValidation, localizationController.getLocalizationByKey);

localizationRoutes.get(
    "/get/key/:locale/:key",
    requireRouteParam("locale"),
    requireRouteParam("key"),
    getLocalizationValidation,
    localizationController.getLocalizationByKey,
);

localizationRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateLocalizationValidation,
    localizationController.updateLocalization,
);

localizationRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateLocalizationValidation,
    localizationController.updateLocalization,
);

localizationRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields("id", "isActive"),
    changeLocalizationStatusValidation,
    localizationController.changeLocalizationStatus,
);

localizationRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeLocalizationStatusValidation,
    localizationController.changeLocalizationStatus,
);

localizationRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteLocalizationValidation,
    localizationController.deleteLocalization,
);

localizationRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteLocalizationValidation,
    localizationController.deleteLocalization,
);

export default localizationRoutes;
