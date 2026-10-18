import {
    Types,
} from "mongoose";

import type {
    QueryFilter,
} from "mongoose";

import {
    PlanPriceModel,
} from "../models/planPrice.model.js";

import type {
    IPlanPriceCreate,
    IPlanPriceDocument,
    IPlanPriceFilter,
    IPlanPriceUpdate,
} from "../interfaces/planPrice.interface.js";

import type {
    BillingInterval,
} from "../constants/planPrice.enums.js";


const PLAN_PRICE_FIELDS = [
    "_id",
    "planId",
    "currencyId",
    "billingInterval",
    "amountMinor",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt",
].join(" ");


export class PlanPriceRepository {

    async create(
        data:
            IPlanPriceCreate & {
                createdBy?:
                Types.ObjectId | null;
            }
    ) {

        const price =
            await PlanPriceModel.create(
                data
            );


        return this.findById(
            price._id.toString()
        );
    }


    async findById(
        id: string
    ) {

        return PlanPriceModel
            .findById(
                id
            )
            .select(
                PLAN_PRICE_FIELDS
            );
    }


    async findByCombination(
        planId: string,
        currencyId: string,
        billingInterval: BillingInterval
    ) {

        return PlanPriceModel
            .findOne({
                planId:
                    new Types.ObjectId(
                        planId
                    ),

                currencyId:
                    new Types.ObjectId(
                        currencyId
                    ),

                billingInterval,
            })
            .select(
                PLAN_PRICE_FIELDS
            );
    }


    async existsByCombination(
        planId: string,
        currencyId: string,
        billingInterval: BillingInterval
    ): Promise<boolean> {

        const exists =
            await PlanPriceModel.exists({
                planId:
                    new Types.ObjectId(
                        planId
                    ),

                currencyId:
                    new Types.ObjectId(
                        currencyId
                    ),

                billingInterval,
            });


        return !!exists;
    }


    async findByPlanId(
        planId: string
    ) {

        return PlanPriceModel
            .find({
                planId:
                    new Types.ObjectId(
                        planId
                    ),

                isActive:
                    true,
            })
            .select(
                PLAN_PRICE_FIELDS
            )
            .sort({
                sortOrder:
                    1,

                amountMinor:
                    1,
            });
    }


    async updateById(
        id: string,
        data:
            IPlanPriceUpdate & {
                isActive?:
                boolean;

                updatedBy?:
                Types.ObjectId | null;
            }
    ) {

        return PlanPriceModel
            .findByIdAndUpdate(
                id,
                data,
                {
                    new:
                        true,

                    runValidators:
                        true,
                }
            )
            .select(
                PLAN_PRICE_FIELDS
            );
    }


    async deleteById(
        id: string
    ) {

        return PlanPriceModel
            .findByIdAndDelete(
                id
            )
            .select(
                PLAN_PRICE_FIELDS
            );
    }


    async findAll(
        filters:
            IPlanPriceFilter = {}
    ) {

        const {
            planId,
            currencyId,
            billingInterval,
            isActive,

            page = 1,
            limit = 10,

            sortBy =
            "sortOrder",

            sortOrder =
            "asc",
        } = filters;


        const query:
            QueryFilter<IPlanPriceDocument> = {};


        if (
            planId
        ) {
            query.planId =
                new Types.ObjectId(
                    planId.toString()
                );
        }


        if (
            currencyId
        ) {
            query.currencyId =
                new Types.ObjectId(
                    currencyId.toString()
                );
        }


        if (
            billingInterval !==
            undefined
        ) {
            query.billingInterval =
                billingInterval;
        }


        if (
            isActive !==
            undefined
        ) {
            query.isActive =
                isActive;
        }


        const safePage =
            Math.max(
                1,
                page
            );


        const safeLimit =
            Math.max(
                1,
                Math.min(
                    limit,
                    100
                )
            );


        const skip =
            (
                safePage -
                1
            ) *
            safeLimit;


        const [
            data,
            total,
        ] =
            await Promise.all([

                PlanPriceModel
                    .find(
                        query
                    )
                    .select(
                        PLAN_PRICE_FIELDS
                    )
                    .sort({
                        [sortBy]:
                            sortOrder ===
                                "asc"
                                ? 1
                                : -1,
                    })
                    .skip(
                        skip
                    )
                    .limit(
                        safeLimit
                    ),

                PlanPriceModel
                    .countDocuments(
                        query
                    ),
            ]);


        return {
            data,

            pagination: {
                page:
                    safePage,

                limit:
                    safeLimit,

                total,

                totalPages:
                    Math.ceil(
                        total /
                        safeLimit
                    ),
            },
        };
    }
}