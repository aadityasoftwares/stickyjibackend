import { seedSystemSettings } from "../../../modules/systemsettings/seeders/systemSetting.seeder.js";

export const executeSystemSettingsSeed = async (): Promise<void> => {
    await seedSystemSettings();
};
