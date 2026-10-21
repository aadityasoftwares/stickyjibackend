import { FeatureModel } from "../modules/feature/models/feature.model.js";
import { subscriptionEntitlementService } from "../modules/subscriptionentitlement/services/subscriptionentitlement.service.js";
import { BillingScopeType } from "../modules/subscriptionusage/constants/subscriptionusage.enums.js";
import { FeatureType, FeatureCode } from "../modules/feature/constants/feature.enums.js";
import { AppError } from "./errors/app.error.js";

export class FeatureAccessUtil {
    async getFeatureValue(userId: string, featureKey: string) {
        const feature = await FeatureModel.findOne({ code: featureKey as FeatureCode })
            .lean()
            .exec();
        if (!feature) throw new AppError("Feature not found.", 404);
        const config = await subscriptionEntitlementService.getResourceLimit(
            { type: BillingScopeType.USER, id: userId },
            feature.code,
        );
        if (feature.type === FeatureType.BOOLEAN) return config.isEnabled;
        return config.isEnabled ? (config.isUnlimited ? Infinity : config.limit) : 0;
    }
}
