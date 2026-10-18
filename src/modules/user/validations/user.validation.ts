import { UserStatus, UserAuthProvider } from "../constants/user.enums.js";

export const UserValidation = {
    statuses: Object.values(UserStatus),
    authProviders: Object.values(UserAuthProvider),
};