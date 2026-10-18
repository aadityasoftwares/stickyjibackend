
import {
    PlanFeatureMessages,
} from "../constants/planFeature.messages.js";

import {
    PlanFeatureLimitType,
} from "../constants/planFeature.enums.js";

import {
    AppError,
} from "../../../utils/errors/app.error.js";
import { FeatureRepository } from "../../feature/repository/feature.repository.js";
import { PlanRepository } from "../../plan/repositories/plan.repository.js";
import { IPlanFeature, IPlanFeatureFilter } from "../interfaces/planfeature.interface.js";
import { PlanFeatureRepository } from "../repositories/planfeature.repository.js";

export class PlanFeatureService {

    private planFeatureRepository: PlanFeatureRepository;
    private planRepository: PlanRepository;
    private featureRepository: FeatureRepository;

    constructor() {
        this.planFeatureRepository = new PlanFeatureRepository();
        this.planRepository = new PlanRepository();
        this.featureRepository = new FeatureRepository();
    }

    async createPlanFeature(data: IPlanFeature) {

        const plan = await this.planRepository
            .findById(
                data.planId.toString()
            );

        if (!plan) {
            throw new AppError(
                PlanFeatureMessages.INVALID_PLAN,
                404
            );
        }

        const feature = await this.featureRepository
            .findById(
                data.featureId.toString()
            );

        if (!feature) {
            throw new AppError(
                PlanFeatureMessages.INVALID_FEATURE,
                404
            );
        }

        const exists = await this.planFeatureRepository.existsByPlanAndFeature(
            data.planId.toString(),
            data.featureId.toString()
        );

        if (exists) {
            throw new AppError(
                PlanFeatureMessages.DUPLICATE_PLAN_FEATURE,
                409
            );
        }

        return this.planFeatureRepository.create(data);
    }

    async getPlanFeatureById(id: string) {

        const planFeature = await this.planFeatureRepository.findById(id);

        if (!planFeature) {
            throw new AppError(
                PlanFeatureMessages.NOT_FOUND,
                404
            );
        }

        return planFeature;
    }

    async getPlanFeatureByPlanAndFeature(planId: string, featureId: string) {

        const planFeature = await this.planFeatureRepository.findByPlanAndFeature(
            planId,
            featureId
        );

        if (!planFeature) {
            throw new AppError(
                PlanFeatureMessages.NOT_FOUND,
                404
            );
        }
        return planFeature;
    }

    async getPlanFeatures(filters: IPlanFeatureFilter = {}) {
        return this.planFeatureRepository.findAll(filters);
    }

    async updatePlanFeature(id: string, data: Partial<IPlanFeature>) {

        const planFeature = await this.planFeatureRepository.findById(id);

        if (!planFeature) {
            throw new AppError(
                PlanFeatureMessages.NOT_FOUND,
                404
            );
        }

        let feature: any = planFeature.featureId;

        if (data.featureId) {

            feature = await this.featureRepository.findById(data.featureId.toString());

            if (!feature) {
                throw new AppError(
                    PlanFeatureMessages.INVALID_FEATURE,
                    404
                );
            }
        }

        if (data.planId || data.featureId) {

            const planId = data.planId ? data.planId.toString() : planFeature.planId.toString();

            const featureId = data.featureId ? data.featureId.toString() : planFeature.featureId.toString();

            const existing = await this.planFeatureRepository.findByPlanAndFeature(planId, featureId);

            if (existing && existing._id.toString() !== id) {
                throw new AppError(
                    PlanFeatureMessages.DUPLICATE_PLAN_FEATURE,
                    409
                );
            }
        }

        return this.planFeatureRepository.updateById(id, data);
    }


    async deletePlanFeature(id: string) {

        const planFeature = await this.planFeatureRepository.findById(id);

        if (!planFeature) {
            throw new AppError(
                PlanFeatureMessages.NOT_FOUND,
                404
            );
        }

        return this.planFeatureRepository.deleteById(id);
    }

    async changePlanFeatureStatus(id: string, isEnabled: boolean) {

        const planFeature = await this.planFeatureRepository.findById(id);

        if (!planFeature) {
            throw new AppError(
                PlanFeatureMessages.NOT_FOUND,
                404
            );
        }

        return this.planFeatureRepository.updateById(id, { isEnabled, });
    }


}