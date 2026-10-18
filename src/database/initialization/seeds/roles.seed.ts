import { seedRoles } from "../../../modules/roles/seeders/role.seeder.js";

export const executeRolesSeed = async (): Promise<void> => {
    await seedRoles();
};
