import { Types } from "mongoose";

import type {
    IPlanPriceCreate,
    IPlanPriceFilter,
    IPlanPriceUpdate,
} from "../interfaces/planPrice.interface.js";

import { PlanPriceRepository } from "../repositories/planPrice.repository.js";

import { PlanRepository } from "../../plan/repositories/plan.repository.js";

import { CurrencyRepository } from "../../currency/repositories/currency.repository.js";

import { PlanPriceMessages } from "../constants/planPrice.messages.js";

import { AppError } from "../../../utils/errors/app.error.js";

import { PlanType, PlanPricingModel } from "../../plan/constants/plan.enums.js";

import { AuditLogService } from "../../auditlog/services/auditLog.service.js";

import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

const PLAN_PRICE_SORT_FIELDS = new Set([
    "amountMinor",
    "billingInterval",
    "sortOrder",
    "createdAt",
    "updatedAt",
]);

export class PlanPriceService {
    private planPriceRepository: PlanPriceRepository;

    private planRepository: PlanRepository;

    private currencyRepository: CurrencyRepository;

    private auditLogService: AuditLogService;

    constructor() {
        this.planPriceRepository = new PlanPriceRepository();

        this.planRepository = new PlanRepository();

        this.currencyRepository = new CurrencyRepository();

        this.auditLogService = new AuditLogService();
    }

    async createPlanPrice(data: IPlanPriceCreate, context?: IAuditLogContext) {
        const planId = data.planId.toString();

        const currencyId = data.currencyId.toString();

        this.validateObjectId(planId, PlanPriceMessages.INVALID_PLAN_ID);

        this.validateObjectId(currencyId, PlanPriceMessages.INVALID_CURRENCY_ID);

        const plan = await this.planRepository.findById(planId);

        if (!plan) {
            throw new AppError(PlanPriceMessages.PLAN_NOT_FOUND, 404);
        }

        /*
         * FREE plan has no PlanPrice rows.
         *
         * Pricing page simply knows FREE = ₹0.
         */
        if (plan.type === PlanType.FREE) {
            throw new AppError(PlanPriceMessages.FREE_PLAN_PRICE_NOT_ALLOWED, 400);
        }

        /*
         * Only fixed-price plans should
         * have PlanPrice entries.
         */
        if (plan.pricingModel !== PlanPricingModel.FIXED) {
            throw new AppError(PlanPriceMessages.PLAN_NOT_PRICEABLE, 400);
        }

        const currency = await this.currencyRepository.findById(currencyId);

        if (!currency) {
            throw new AppError(PlanPriceMessages.CURRENCY_NOT_FOUND, 404);
        }

        if (!currency.isActive) {
            throw new AppError(PlanPriceMessages.CURRENCY_INACTIVE, 400);
        }

        const duplicate = await this.planPriceRepository.existsByCombination(
            planId,
            currencyId,
            data.billingInterval,
        );

        if (duplicate) {
            throw new AppError(PlanPriceMessages.ALREADY_EXISTS, 409);
        }

        this.validateAmount(data.amountMinor);

        const actorId = this.resolveActorId(context);

        const planPrice = await this.planPriceRepository.create({
            ...data,

            planId: new Types.ObjectId(planId),

            currencyId: new Types.ObjectId(currencyId),

            createdBy: actorId,
        });

        if (!planPrice) {
            throw new AppError("Unable to create plan price.", 500);
        }

        await this.auditLogService.logCreate(
            context ?? {},
            {
                module: AppModule.PLAN_PRICE,

                resourceId: planPrice._id.toString(),

                resourceName: `${plan.name} ${data.billingInterval}`,
            },

            `Price for ${plan.name} (${data.billingInterval}) was created successfully.`,
        );

        return planPrice;
    }

    async getPlanPriceById(id: string) {
        this.validateObjectId(id, "Invalid plan price ID.");

        const planPrice = await this.planPriceRepository.findById(id);

        if (!planPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        return planPrice;
    }

    async getPlanPrices(filters: IPlanPriceFilter = {}) {
        if (filters.planId) {
            this.validateObjectId(filters.planId.toString(), PlanPriceMessages.INVALID_PLAN_ID);
        }

        if (filters.currencyId) {
            this.validateObjectId(filters.currencyId.toString(), PlanPriceMessages.INVALID_CURRENCY_ID);
        }

        if (filters.sortBy && !PLAN_PRICE_SORT_FIELDS.has(filters.sortBy)) {
            filters.sortBy = "sortOrder";
        }

        return this.planPriceRepository.findAll(filters);
    }

    async getPricesByPlanId(planId: string) {
        this.validateObjectId(planId, PlanPriceMessages.INVALID_PLAN_ID);

        const plan = await this.planRepository.findById(planId);

        if (!plan) {
            throw new AppError(PlanPriceMessages.PLAN_NOT_FOUND, 404);
        }

        return this.planPriceRepository.findByPlanId(planId);
    }

    async updatePlanPrice(id: string, data: IPlanPriceUpdate, context?: IAuditLogContext) {
        this.validateObjectId(id, "Invalid plan price ID.");

        if (Object.keys(data).length === 0) {
            throw new AppError(PlanPriceMessages.UPDATE_REQUIRED, 400);
        }

        const planPrice = await this.planPriceRepository.findById(id);

        if (!planPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        if (data.amountMinor !== undefined) {
            this.validateAmount(data.amountMinor);
        }

        const changes = this.buildAuditChanges(planPrice, data);

        const updatedPlanPrice = await this.planPriceRepository.updateById(id, {
            ...data,

            updatedBy: this.resolveActorId(context),
        });

        if (!updatedPlanPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.PLAN_PRICE,

                    resourceId: planPrice._id.toString(),

                    resourceName: `${planPrice.billingInterval} price`,
                },

                "Plan price was updated successfully.",

                changes,
            );
        }

        return updatedPlanPrice;
    }

    async changePlanPriceStatus(id: string, isActive: boolean, context?: IAuditLogContext) {
        this.validateObjectId(id, "Invalid plan price ID.");

        const planPrice = await this.planPriceRepository.findById(id);

        if (!planPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        if (planPrice.isActive === isActive) {
            return planPrice;
        }

        const oldStatus = planPrice.isActive;

        const updatedPlanPrice = await this.planPriceRepository.updateById(id, {
            isActive,

            updatedBy: this.resolveActorId(context),
        });

        if (!updatedPlanPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logStatusChange(
            context ?? {},
            {
                module: AppModule.PLAN_PRICE,

                resourceId: planPrice._id.toString(),

                resourceName: `${planPrice.billingInterval} price`,
            },

            "isActive",

            oldStatus,

            isActive,

            `Plan price status changed from ${oldStatus ? "active" : "inactive"} to ${isActive ? "active" : "inactive"}.`,
        );

        return updatedPlanPrice;
    }

    async deletePlanPrice(id: string, context?: IAuditLogContext) {
        this.validateObjectId(id, "Invalid plan price ID.");

        const planPrice = await this.planPriceRepository.findById(id);

        if (!planPrice) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        const deleted = await this.planPriceRepository.deleteById(id);

        if (!deleted) {
            throw new AppError(PlanPriceMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.PLAN_PRICE,

                resourceId: planPrice._id.toString(),

                resourceName: `${planPrice.billingInterval} price`,
            },

            "Plan price was deleted successfully.",
        );

        return deleted;
    }

    private validateAmount(amountMinor: number): void {
        if (typeof amountMinor !== "number" || amountMinor <= 0 || !Number.isInteger(amountMinor)) {
            throw new AppError(PlanPriceMessages.INVALID_AMOUNT, 400);
        }
    }

    private validateObjectId(value: string, message: string): void {
        if (!Types.ObjectId.isValid(value)) {
            throw new AppError(message, 400);
        }
    }

    private resolveActorId(context?: IAuditLogContext): Types.ObjectId | null {
        const actorId = context?.actorId;

        if (!actorId) {
            return null;
        }

        if (actorId instanceof Types.ObjectId) {
            return actorId;
        }

        if (Types.ObjectId.isValid(actorId.toString())) {
            return new Types.ObjectId(actorId.toString());
        }

        return null;
    }

    private buildAuditChanges(planPrice: any, data: IPlanPriceUpdate) {
        return Object.keys(data)
            .filter((field) => planPrice[field] !== (data as Record<string, unknown>)[field])
            .map((field) => ({
                field,

                oldValue: planPrice[field],

                newValue: (data as Record<string, unknown>)[field],
            }));
    }
}
