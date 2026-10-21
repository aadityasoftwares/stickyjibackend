import { Types } from "mongoose";
import { SubscriptionSeedService } from "../../src/seeders/subscription/services/subscription-seed.service.ts";
import { UserModel } from "../../src/modules/user/models/user.model.ts";
import { WorkspaceModel } from "../../src/modules/workspace/models/workspace.model.ts";
import { FeatureModel } from "../../src/modules/feature/models/feature.model.ts";
import { PlanFeatureModel } from "../../src/modules/planfeature/models/planfeature.model.ts";

// Authorization/lifecycle tests need valid plans, while the subscription suites
// exercise real quotas. Keep billing enforcement active in these fixtures.
export async function seedProductSubscriptionFixtures() {
    await new SubscriptionSeedService().run({ mode: "apply" });
    const quotas = await FeatureModel.find({ type: "QUOTA" }).select("_id").lean();
    await PlanFeatureModel.updateMany(
        { featureId: { $in: quotas.map((feature) => feature._id) } },
        { $set: { isUnlimited: true } },
    );
    for (const ownerId of await WorkspaceModel.distinct("ownerId")) {
        await UserModel.updateOne(
            { _id: ownerId },
            {
                $setOnInsert: {
                    email: `fixture-${ownerId}@example.test`,
                    globalRoleId: new Types.ObjectId(),
                    status: "ACTIVE",
                    isDeleted: false,
                },
            },
            { upsert: true },
        );
    }
}
