import type { IFeature, IFeatureFilter } from "../interfaces/feature.interface.js";
import { FeatureMessages } from "../constants/feature.messages.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureRepository } from "../repository/feature.repository.js";

export class FeatureService {
    private featureRepository: FeatureRepository;

    constructor() {
        this.featureRepository = new FeatureRepository();
    }

    async createFeature(data: IFeature) {
        data.name = StringHelper.normalize(data.name);
        data.description = StringHelper.normalize(data.description);
        const codeExists = await this.featureRepository.existsByCode(data.code);
        if (codeExists) {
            throw new AppError(FeatureMessages.ALREADY_EXISTS, 409);
        }
        return this.featureRepository.create(data);
    }

    async getFeatureById(id: string) {
        const feature = await this.featureRepository.findById(id);

        if (!feature) {
            throw new AppError(FeatureMessages.NOT_FOUND, 404);
        }

        return feature;
    }

    async getFeatureByCode(code: string) {
        const feature = await this.featureRepository.findByCode(code);

        if (!feature) {
            throw new AppError(FeatureMessages.NOT_FOUND, 404);
        }

        return feature;
    }

    async getFeatures(filters: IFeatureFilter = {}) {
        return this.featureRepository.findAll(filters);
    }

    async updateFeature(id: string, data: Partial<IFeature>) {
        const feature = await this.featureRepository.findById(id);

        if (!feature) {
            throw new AppError(FeatureMessages.NOT_FOUND, 404);
        }

        if (feature.isSystem) {
            throw new AppError(FeatureMessages.SYSTEM_FEATURE_UPDATE, 403);
        }

        if (feature.isDefault) {
            throw new AppError(FeatureMessages.DEFAULT_FEATURE_UPDATE, 403);
        }

        if (data.name) {
            data.name = StringHelper.normalize(data.name);
        }

        if (data.description) {
            data.description = StringHelper.normalize(data.description);
        }

        if (data.code) {
            const existingFeature = await this.featureRepository.findByCode(data.code);

            if (existingFeature && existingFeature._id.toString() !== id) {
                throw new AppError(FeatureMessages.CODE_ALREADY_EXISTS, 409);
            }
        }

        return this.featureRepository.updateById(id, data);
    }

    async deleteFeature(id: string) {
        const feature = await this.featureRepository.findById(id);

        if (!feature) {
            throw new AppError(FeatureMessages.NOT_FOUND, 404);
        }

        if (feature.isSystem) {
            throw new AppError(FeatureMessages.SYSTEM_FEATURE_DELETE, 403);
        }

        if (feature.isDefault) {
            throw new AppError(FeatureMessages.DEFAULT_FEATURE_DELETE, 403);
        }

        return this.featureRepository.deleteById(id);
    }

    async changeFeatureStatus(id: string, isActive: boolean) {
        const feature = await this.featureRepository.findById(id);

        if (!feature) {
            throw new AppError(FeatureMessages.NOT_FOUND, 404);
        }

        if (feature.isSystem) {
            throw new AppError(FeatureMessages.CANNOT_DEACTIVATE_SYSTEM, 403);
        }

        if (feature.isDefault && !isActive) {
            throw new AppError(FeatureMessages.CANNOT_DEACTIVATE_DEFAULT, 403);
        }

        return this.featureRepository.updateById(id, {
            isActive,
        });
    }
}
