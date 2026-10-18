import { LanguageModel } from "../models/language.model.js";
import { LanguageDirection, LanguageCode } from "../constants/language.enums.js";

export const seedLanguages = async (): Promise<void> => {
    await LanguageModel.findOneAndUpdate(
        {
            code: LanguageCode.ENGLISH,
        },
        {
            $set: {
                name: "English",
                nativeName: "English",
                code: LanguageCode.ENGLISH,
                locale: "en-US",
                direction: LanguageDirection.LTR,
                isDefault: true,
                isSystem: true,
                isActive: true,
                createdBy: null,
                updatedBy: null,
            },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        },
    );

    console.log("Default English language seeded successfully.");
};
