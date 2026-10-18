import { FeatureModel } from "../modules/feature/models/feature.model.js";
import { PlanFeatureModel } from "../modules/planfeature/models/planfeature.model.js";
import { UserSubscriptionModel } from "../modules/usersubscription/models/usersubscription.model.js";
import { UserSubscriptionStatus } from "../modules/usersubscription/constants/usersubscription.enums.js";

export class FeatureAccessUtil {
    async getFeatureValue(userId: string, featureKey: string) {
        console.log(userId, featureKey);

        const subscription = await UserSubscriptionModel.findOne({
            user: userId,
            isActive: true,
            status: UserSubscriptionStatus.ACTIVE,
        });

        if (!subscription) {
            throw new Error("No active subscription found");
        }

        const feature = await FeatureModel.findOne({ key: featureKey, isActive: true });
        if (!feature) throw new Error("Feature not found");

        const planFeature = await PlanFeatureModel.findOne({
            plan: subscription.plan,
            feature: feature._id,
            isActive: true,
        });

        console.log(subscription.plan, feature._id);

        if (!planFeature) {
            throw new Error(`Feature not configured for this plan`);
        }

        return planFeature.value;
    }
}
