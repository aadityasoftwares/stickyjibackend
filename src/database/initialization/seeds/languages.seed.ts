import { seedLanguages } from "../../../modules/languages/seeders/language.seeder.js";

export const executeLanguagesSeed = async (): Promise<void> => {
    await seedLanguages();
};
