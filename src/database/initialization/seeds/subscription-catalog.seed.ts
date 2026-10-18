import { SubscriptionSeedService } from "../../../seeders/subscription/services/subscription-seed.service.js";
import { AppError } from "../../../utils/errors/app.error.js";

export const executeSubscriptionCatalogSeed = async (): Promise<void> => {
    const service = new SubscriptionSeedService();
    service.validateConfiguration();

    const report = await service.run({
        mode: "apply",
        ensureIndexes: true,
        syncDefaults: false,
    });

    if (!report.valid || !report.applied) {
        const issues = [...report.conflicts, ...report.errors].join("; ");
        throw new AppError(
            `Subscription catalog seeding failed: ${issues || "Validation failed"}`,
            409
        );
    }

    console.log(
        [
            "Subscription catalog seeded successfully.",
            `Plans created: ${report.counts.plans.created}, unchanged: ${report.counts.plans.unchanged}`,
            `Features created: ${report.counts.features.created}, unchanged: ${report.counts.features.unchanged}`,
            `PlanFeatures created: ${report.counts.planFeatures.created}, unchanged: ${report.counts.planFeatures.unchanged}`,
            `PlanPrices created: ${report.counts.planPrices.created}, unchanged: ${report.counts.planPrices.unchanged}`,
        ].join(" ")
    );
};
