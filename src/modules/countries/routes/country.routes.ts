import { Router } from "express";

import { CountryController } from "../controllers/country.controller.js";

import { createCountryValidation } from "../validations/createCountry.validation.js";
import { updateCountryValidation } from "../validations/updateCountry.validation.js";
import { getCountryValidation } from "../validations/getCountry.validation.js";
import { changeCountryStatusValidation } from "../validations/changeCountryStatus.validation.js";
import { deleteCountryValidation } from "../validations/deleteCountry.validation.js";

import { requireBodyFields } from "../../../utils/validations/validateBody.validation.js";
import { requireRouteParam } from "../../../utils/validations/validateParam.validation.js";
import { validateContentType } from "../../../utils/validations/validateContentType.js";

const countryRoutes = Router();

const countryController = new CountryController();


// Create Country
countryRoutes.post(
    "/create",
    validateContentType("application/json"),
    requireBodyFields(
        "name",
        "code",
        "alpha3Code",
        "numericCode",
        "dialCode",
        "continent",
        "currencyCode"
    ),
    createCountryValidation,
    countryController.createCountry
);


// Get All Countries
countryRoutes.get(
    "/getall",
    countryController.getCountries
);


// Get Country By ID
countryRoutes.get(
    "/get",
    getCountryValidation,
    countryController.getCountryById
);

countryRoutes.get(
    "/get/:id",
    requireRouteParam("id"),
    getCountryValidation,
    countryController.getCountryById
);


// Get Country By Code
countryRoutes.get(
    "/get/code",
    getCountryValidation,
    countryController.getCountryByCode
);

countryRoutes.get(
    "/get/code/:code",
    requireRouteParam("code"),
    getCountryValidation,
    countryController.getCountryByCode
);


// Update Country
countryRoutes.put(
    "/update",
    validateContentType("application/json"),
    requireBodyFields("id"),
    updateCountryValidation,
    countryController.updateCountry
);

countryRoutes.put(
    "/update/:id",
    validateContentType("application/json"),
    requireRouteParam("id"),
    updateCountryValidation,
    countryController.updateCountry
);


// Change Country Status
countryRoutes.patch(
    "/update/status",
    validateContentType("application/json"),
    requireBodyFields(
        "id",
        "isActive"
    ),
    changeCountryStatusValidation,
    countryController.changeCountryStatus
);

countryRoutes.patch(
    "/update/:id/status",
    validateContentType("application/json"),
    requireRouteParam("id"),
    requireBodyFields("isActive"),
    changeCountryStatusValidation,
    countryController.changeCountryStatus
);


// Delete Country
countryRoutes.delete(
    "/delete",
    requireBodyFields("id"),
    deleteCountryValidation,
    countryController.deleteCountry
);

countryRoutes.delete(
    "/delete/:id",
    requireRouteParam("id"),
    deleteCountryValidation,
    countryController.deleteCountry
);


export default countryRoutes;