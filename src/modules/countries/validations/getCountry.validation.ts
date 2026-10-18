import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { CountryMessages } from "../constants/country.messages.js";
import { CountryValidation } from "./country.validation.js";
import { validateId } from "../../../utils/validations/validateId.validation.js";
import { RequestUtil } from "../../../utils/request.util.js";
import { CountryCode } from "../constants/country.enums.js";


export const getCountryValidation = (req: Request, res: Response, next: NextFunction) => {

    if (req.params.id) {
        return validateId(req, res, next);
    }

    const code = RequestUtil.getParam(req.params.code);

    if (!code) {
        throw new AppError(
            CountryMessages.CODE_REQUIRED,
            400
        );
    }


    const normalizedCode = code.toUpperCase();

    if (!CountryValidation.codes.includes(normalizedCode as CountryCode)) {
        throw new AppError(
            CountryMessages.INVALID_CODE,
            400
        );
    }

    next();
};