import mongoose from "mongoose";
import dotenv from "dotenv";
import { seedRoles } from "../modules/roles/seeders/role.seeder.js";
import { seedLanguages } from "../modules/languages/seeders/language.seeder.js";
import { seedCountries } from "../modules/countries/seeders/country.seeder.js";
import { seedTimezones } from "../modules/timezones/seeders/timezone.seeder.js";
import { seedPermissions } from "../modules/permissions/seeders/permission.seeder.js";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

export async function connectDatabase() {
    try {
        await mongoose.connect(MONGO_URI);
        await seedDefaultData();
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

async function seedDefaultData() {
    await seedPermissions();
    await seedRoles();
    await seedLanguages();
    await seedCountries();
    await seedTimezones();
    // Subscription catalog and its INR currency are provisioned explicitly through
    // seed:subscriptions. Startup must never overwrite customer pricing or policy.

}
