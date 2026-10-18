import { TimezoneModel } from "../models/timezone.model.js";
import { CountryCode } from "../../countries/constants/country.enums.js";

const TIMEZONE_SEED_DATA = [
    {
        name: "India Standard Time",
        code: "Asia/Kolkata",
        countryCode: CountryCode.INDIA,
        utcOffset: "+05:30",
        isDefault: true,
        isSystem: true,
        isActive: true,
    },
] as const;

export const seedTimezones = async (): Promise<void> => {
    console.log("🌱 Seeding timezones...");

    const operations: any = TIMEZONE_SEED_DATA.map((timezone) => ({
        updateOne: {
            filter: {
                code: timezone.code,
            },
            update: {
                $set: {
                    name: timezone.name,
                    countryCode: timezone.countryCode,
                    utcOffset: timezone.utcOffset,
                    isDefault: timezone.isDefault,
                    isSystem: timezone.isSystem,
                    isActive: timezone.isActive,
                    updatedBy: null,
                },
                $setOnInsert: {
                    code: timezone.code,
                    createdBy: null,
                },
            },
            upsert: true,
        },
    }));

    const result = await TimezoneModel.bulkWrite(operations);

    console.log("✅ Timezones seeded successfully.", {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        inserted: result.upsertedCount,
    });
};
