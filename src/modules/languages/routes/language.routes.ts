import { Router } from "express";
import { LanguageController } from "../controllers/language.controller.js";
import { createLanguageValidation } from "../validations/createLanguage.validation.js";
import { updateLanguageValidation } from "../validations/updateLanguage.validation.js";
import { getLanguageValidation } from "../validations/getLanguage.validation.js";
import { changeLanguageStatusValidation } from "../validations/changeLanguageStatus.validation.js";
import { deleteLanguageValidation } from "../validations/deleteLanguage.validation.js";

import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const languageRoutes = Router();

const languageController = new LanguageController();

languageRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("name", "nativeName", "code", "locale"),
    createLanguageValidation,
    languageController.createLanguage,
);

languageRoutes.get("/getall", languageController.getLanguages);

languageRoutes.get("/get", getLanguageValidation, languageController.getLanguageById);

languageRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getLanguageValidation,
    languageController.getLanguageById,
);

languageRoutes.get("/get/code", getLanguageValidation, languageController.getLanguageByCode);

languageRoutes.get(
    "/get/code/:code",
    requireRouteParam("code"),
    getLanguageValidation,
    languageController.getLanguageByCode,
);

languageRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateLanguageValidation,
    languageController.updateLanguage,
);

languageRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateLanguageValidation,
    languageController.updateLanguage,
);

languageRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields("id", "isActive"),
    changeLanguageStatusValidation,
    languageController.changeLanguageStatus,
);

languageRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeLanguageStatusValidation,
    languageController.changeLanguageStatus,
);

languageRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteLanguageValidation,
    languageController.deleteLanguage,
);

languageRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteLanguageValidation,
    languageController.deleteLanguage,
);

export default languageRoutes;
