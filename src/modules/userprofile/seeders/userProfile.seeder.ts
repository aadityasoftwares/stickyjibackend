import { UserProfileModel } from "../models/userProfile.model.js";
import { LanguageModel } from "../../languages/models/language.model.js";
import { LanguageCode } from "../../languages/constants/language.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";

/**
 * Backfill/seed default English language for any user profiles that currently have null or unset languageId.
 */
export const seedMissingUserProfileLanguages = async (): Promise<{ updatedCount: number }> => {
    let language = await LanguageModel.findOne({ code: LanguageCode.ENGLISH });
    if (!language) {
        language = await LanguageModel.findOne({ isDefault: true });
    }

    if (!language) {
        throw new AppError("Language 'en' is not configured.", 503);
    }

    const result = await UserProfileModel.updateMany(
        {
            $or: [{ languageId: null }, { languageId: { $exists: false } }],
        },
        {
            $set: { languageId: language._id },
        },
    );

    return { updatedCount: result.modifiedCount };
};
