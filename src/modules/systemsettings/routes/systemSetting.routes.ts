import { Router } from "express";
import { SystemSettingController } from "../controllers/systemSetting.controller.js";
import { createSystemSettingValidation } from "../validations/createSystemSetting.validation.js";
import { updateSystemSettingValidation } from "../validations/updateSystemSetting.validation.js";
import { getSystemSettingValidation } from "../validations/getSystemSetting.validation.js";
import { resetSystemSettingValidation } from "../validations/resetSystemSetting.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const systemSettingRoutes = Router();
const systemSettingController = new SystemSettingController();

systemSettingRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields("key", "value", "valueType", "category", "description"),
    createSystemSettingValidation,
    systemSettingController.createSystemSetting
);

systemSettingRoutes.get(
    "/getall",
    systemSettingController.getSystemSettings
);

systemSettingRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getSystemSettingValidation,
    systemSettingController.getSystemSettingById
);

systemSettingRoutes.get(
    "/get/key/:key",
    requireRouteParam("key"),
    getSystemSettingValidation,
    systemSettingController.getSystemSettingByKey
);

systemSettingRoutes.get(
    "/public",
    systemSettingController.getPublicSystemSettings
);

systemSettingRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateSystemSettingValidation,
    systemSettingController.updateSystemSetting
);

systemSettingRoutes.patch(
    "/reset/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    resetSystemSettingValidation,
    systemSettingController.resetSystemSetting
);

export default systemSettingRoutes;