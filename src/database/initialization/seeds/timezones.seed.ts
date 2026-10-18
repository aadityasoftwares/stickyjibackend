import { seedTimezones } from "../../../modules/timezones/seeders/timezone.seeder.js";

export const executeTimezonesSeed = async (): Promise<void> => {
    await seedTimezones();
};
