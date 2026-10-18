import { seedCurrencies } from "../../../modules/currency/seeders/currency.seeder.js";

export const executeCurrenciesSeed = async (): Promise<void> => {
    await seedCurrencies();
};
