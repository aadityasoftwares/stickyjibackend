import {
    Router,
} from "express";

import {
    PlanPriceController,
} from "../controllers/planPrice.controller.js";

import {
    createPlanPriceValidation,
} from "../validations/createPlanPrice.validation.js";

import {
    updatePlanPriceValidation,
} from "../validations/updatePlanPrice.validation.js";

import {
    changePlanPriceStatusValidation,
} from "../validations/changePlanPriceStatus.validation.js";

import {
    getPlanPriceValidation,
} from "../validations/getPlanPrice.validation.js";

import {
    deletePlanPriceValidation,
} from "../validations/deletePlanPrice.validation.js";

import {
    requireBodyFields,
} from "../../../utils/validations/validateBody.validation.js";

import {
    validateContentType,
} from "../../../utils/validations/validateContentType.js";

import {
    authMiddleware,
} from "../../../middlewares/authmiddleware/auth.middleware.js";


const planPriceRoutes =
    Router();

const planPriceController =
    new PlanPriceController();

planPriceRoutes.use(
    authMiddleware
);


planPriceRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields(
        "planId",
        "currencyId",
        "billingInterval",
        "amountMinor"
    ),
    createPlanPriceValidation,
    planPriceController.createPlanPrice
);

planPriceRoutes.get(
    "/getall",
    planPriceController.getPlanPrices
);

planPriceRoutes.get(
    "/get/:id",
    getPlanPriceValidation,
    planPriceController.getPlanPriceById
);

planPriceRoutes.patch(
    "/update/:id",
    validateContentType("application/json"),
    updatePlanPriceValidation,
    planPriceController.updatePlanPrice
);

planPriceRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireBodyFields("isActive"),
    changePlanPriceStatusValidation,
    planPriceController.changePlanPriceStatus
);

planPriceRoutes.delete(
    "/delete/:id",
    deletePlanPriceValidation,
    planPriceController.deletePlanPrice
);

export default planPriceRoutes;