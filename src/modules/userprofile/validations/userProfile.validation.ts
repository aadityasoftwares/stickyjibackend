import { UserProfileType } from "../constants/userProfile.enums.js";

export const UserProfileValidation = {
    profileTypes: Object.values(UserProfileType),
} as const;