import { AppError } from "../../../utils/errors/app.error.js";
import { SUBSCRIPTION_SEED_CONSTANTS } from "../../../seeders/subscription/constants/subscription-seed.constants.js";

/** @deprecated Use the explicit centralized subscription seeder. */
export const seedPlanPrices = async (): Promise<void> => {
    throw new AppError(SUBSCRIPTION_SEED_CONSTANTS.LEGACY_DISABLED, 409);
};
