import { Types } from "mongoose";
import { UserPreferenceService } from "../services/userPreference.service.js";

export class UserPreferenceProvisioningService {
    private userPreferenceService: UserPreferenceService;

    constructor() {
        this.userPreferenceService = new UserPreferenceService();
    }

    async provisionMissingPreferences(userId: string): Promise<void> {
        if (!Types.ObjectId.isValid(userId)) {
            return;
        }

        await this.userPreferenceService.provisionMissingPreferences(userId);
    }
}
