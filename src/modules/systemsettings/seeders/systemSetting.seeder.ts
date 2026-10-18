import { SystemSettingModel } from "../models/systemSetting.model.js";
import { SYSTEM_SETTING_DEFAULTS } from "../constants/systemSetting.constants.js";

export const seedSystemSettings = async (): Promise<void> => {
    if (!SYSTEM_SETTING_DEFAULTS.length) {
        console.log("No system settings configured.");
        return;
    }

    const operations = SYSTEM_SETTING_DEFAULTS.map((setting) => ({
        updateOne: {
            filter: {
                key: setting.key,
            },
            update: {
                $setOnInsert: {
                    key: setting.key,
                    value: setting.defaultValue,
                    createdBy: null,
                },
                $set: {
                    valueType: setting.valueType,
                    category: setting.category,
                    description: setting.description,
                    defaultValue: setting.defaultValue,
                    isEditable: setting.isEditable,
                    isPublic: setting.isPublic,
                    updatedBy: null,
                },
            },
            upsert: true,
        },
    }));

    const result = await SystemSettingModel.bulkWrite(operations);

    console.log(
        [
            "System settings seeded successfully.",
            `Configured: ${SYSTEM_SETTING_DEFAULTS.length}`,
            `Inserted: ${result.upsertedCount}`,
            `Updated: ${result.modifiedCount}`,
            `Matched: ${result.matchedCount}`,
        ].join(" "),
    );
};
