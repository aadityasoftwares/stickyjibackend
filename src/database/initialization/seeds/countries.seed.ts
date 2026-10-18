import { seedCountries } from "../../../modules/countries/seeders/country.seeder.js";

export const executeCountriesSeed = async (): Promise<void> => {
    await seedCountries();
};
