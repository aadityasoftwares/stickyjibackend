import { Router } from "express";
import { CurrencyController } from "../controllers/currency.controller.js";
import { createCurrencyValidation } from "../validations/createCurrency.validation.js";
import { updateCurrencyValidation } from "../validations/updateCurrency.validation.js";
import { getCurrencyValidation } from "../validations/getCurrency.validation.js";
import { changeCurrencyStatusValidation } from "../validations/changeCurrencyStatus.validation.js";
import { deleteCurrencyValidation } from "../validations/deleteCurrency.validation.js";
import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const currencyRoutes = Router();
const currencyController = new CurrencyController();

currencyRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields(
        "name",
        "code",
        "symbol",
        "numericCode",
        "decimalPlaces"
    ),
    createCurrencyValidation,
    currencyController.createCurrency
);

currencyRoutes.get(
    "/getall",
    currencyController.getCurrencies
);

currencyRoutes.get(
    "/get",
    getCurrencyValidation,
    currencyController.getCurrencyById
);

currencyRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getCurrencyValidation,
    currencyController.getCurrencyById
);

currencyRoutes.get(
    "/get/code",
    getCurrencyValidation,
    currencyController.getCurrencyByCode
);

currencyRoutes.get(
    "/get/code/:code",
    requireRouteParam("code"),
    getCurrencyValidation,
    currencyController.getCurrencyByCode
);

currencyRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateCurrencyValidation,
    currencyController.updateCurrency
);

currencyRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateCurrencyValidation,
    currencyController.updateCurrency
);

currencyRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields(
        "id",
        "isActive"
    ),
    changeCurrencyStatusValidation,
    currencyController.changeCurrencyStatus
);

currencyRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeCurrencyStatusValidation,
    currencyController.changeCurrencyStatus
);

currencyRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteCurrencyValidation,
    currencyController.deleteCurrency
);

currencyRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteCurrencyValidation,
    currencyController.deleteCurrency
);

export default currencyRoutes;