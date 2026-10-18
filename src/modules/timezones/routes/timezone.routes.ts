import { Router } from "express";
import { TimezoneController } from "../controllers/timezone.controller.js";
import { createTimezoneValidation } from "../validations/createTimezone.validation.js";
import { updateTimezoneValidation } from "../validations/updateTimezone.validation.js";
import { getTimezoneValidation } from "../validations/getTimezone.validation.js";
import { changeTimezoneStatusValidation } from "../validations/changeTimezoneStatus.validation.js";
import { deleteTimezoneValidation } from "../validations/deleteTimezone.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const timezoneRoutes = Router();
const timezoneController = new TimezoneController();

timezoneRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields(
        "name",
        "code",
        "countryCode",
        "utcOffset"
    ),
    createTimezoneValidation,
    timezoneController.createTimezone
);

timezoneRoutes.get(
    "/getall",
    timezoneController.getTimezones
);

timezoneRoutes.get(
    "/get",
    getTimezoneValidation,
    timezoneController.getTimezoneById
);

timezoneRoutes.get(
    "/get/code",
    getTimezoneValidation,
    timezoneController.getTimezoneByCode
);

timezoneRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getTimezoneValidation,
    timezoneController.getTimezoneById
);

timezoneRoutes.get(
    "/get/country/:countryCode",
    requireRouteParam("countryCode"),
    timezoneController.getTimezonesByCountry
);

timezoneRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateTimezoneValidation,
    timezoneController.updateTimezone
);

timezoneRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateTimezoneValidation,
    timezoneController.updateTimezone
);

timezoneRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields(
        "id",
        "isActive"
    ),
    changeTimezoneStatusValidation,
    timezoneController.changeTimezoneStatus
);

timezoneRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeTimezoneStatusValidation,
    timezoneController.changeTimezoneStatus
);

timezoneRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteTimezoneValidation,
    timezoneController.deleteTimezone
);

timezoneRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteTimezoneValidation,
    timezoneController.deleteTimezone
);

export default timezoneRoutes;