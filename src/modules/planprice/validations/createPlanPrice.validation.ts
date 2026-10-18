import type {
    Request,
    Response,
    NextFunction,
} from "express";

import {
    Types,
} from "mongoose";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    PlanPriceMessages,
} from "../constants/planPrice.messages.js";

import {
    PlanPriceValidation,
} from "./planPrice.validation.js";


export const createPlanPriceValidation = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {

    try {

        const {
            planId,
            currencyId,
            billingInterval,
            amountMinor,
            sortOrder,
            isActive,
        } = req.body;


        if (!planId) {
            throw new AppError(
                PlanPriceMessages.PLAN_ID_REQUIRED,
                400
            );
        }


        if (
            !Types.ObjectId.isValid(
                planId
            )
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_PLAN_ID,
                400
            );
        }


        if (!currencyId) {
            throw new AppError(
                PlanPriceMessages.CURRENCY_ID_REQUIRED,
                400
            );
        }


        if (
            !Types.ObjectId.isValid(
                currencyId
            )
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_CURRENCY_ID,
                400
            );
        }


        if (!billingInterval) {
            throw new AppError(
                PlanPriceMessages.BILLING_INTERVAL_REQUIRED,
                400
            );
        }


        if (
            !PlanPriceValidation
                .billingIntervals
                .includes(
                    billingInterval
                )
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_BILLING_INTERVAL,
                400
            );
        }


        if (
            amountMinor ===
            undefined
        ) {
            throw new AppError(
                PlanPriceMessages.AMOUNT_REQUIRED,
                400
            );
        }


        if (
            typeof amountMinor !==
            "number" ||
            amountMinor <= 0 ||
            !Number.isInteger(
                amountMinor
            )
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_AMOUNT,
                400
            );
        }


        if (
            sortOrder !== undefined &&
            (
                typeof sortOrder !==
                "number" ||
                !Number.isInteger(
                    sortOrder
                )
            )
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_SORT_ORDER,
                400
            );
        }


        if (
            isActive !== undefined &&
            typeof isActive !==
            "boolean"
        ) {
            throw new AppError(
                PlanPriceMessages.INVALID_STATUS,
                400
            );
        }


        next();

    } catch (error) {

        next(
            error
        );
    }
};