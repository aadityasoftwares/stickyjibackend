import { seedPermissions } from "../../../modules/permissions/seeders/permission.seeder.js";

export const executePermissionsSeed = async (): Promise<void> => {
    await seedPermissions();
};
