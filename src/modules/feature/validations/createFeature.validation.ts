import type { Request, Response, NextFunction, } from "express";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { FeatureValidation } from "./feature.validation.js";


export const createFeatureValidation = (req: Request, res: Response, next: NextFunction) => {

    const {
        name,
        code,
        description,
        category,
        type,
        isActive,
        isDefault,
        isSystem,
    } = req.body;


    if (!name) {
        throw new AppError(
            FeatureMessages.NAME_REQUIRED,
            400
        );
    }


    if (!code) {
        throw new AppError(
            FeatureMessages.CODE_REQUIRED,
            400
        );
    }


    if (!FeatureValidation.codes.includes(code)) {
        throw new AppError(
            FeatureMessages.INVALID_CODE,
            400
        );
    }


    if (!description) {
        throw new AppError(
            FeatureMessages.DESCRIPTION_REQUIRED,
            400
        );
    }


    if (!category) {
        throw new AppError(
            FeatureMessages.CATEGORY_REQUIRED,
            400
        );
    }


    if (!FeatureValidation.categories.includes(category)) {
        throw new AppError(
            FeatureMessages.INVALID_CATEGORY,
            400
        );
    }


    if (type !== undefined && !FeatureValidation.types.includes(type)) {
        throw new AppError(
            FeatureMessages.INVALID_TYPE,
            400
        );
    }


    if (isActive !== undefined && typeof isActive !== "boolean") {
        throw new AppError(
            FeatureMessages.INVALID_STATUS,
            400
        );
    }


    if (isDefault !== undefined && typeof isDefault !== "boolean") {
        throw new AppError(
            FeatureMessages.INVALID_DEFAULT,
            400
        );
    }


    if (isSystem !== undefined && typeof isSystem !== "boolean") {
        throw new AppError(
            FeatureMessages.INVALID_SYSTEM,
            400
        );
    }


    next();
};