import { UserStatus, UserAuthProvider } from "./user.enums.js";

export const DEFAULT_USER_STATUS = UserStatus.PENDING;
export const DEFAULT_USER_AUTH_PROVIDER = UserAuthProvider.LOCAL;
export const DEFAULT_USER_EMAIL_VERIFIED = false;
export const DEFAULT_USER_PHONE_VERIFIED = false;
export const DEFAULT_USER_MFA_ENABLED = false;
export const DEFAULT_USER_LOGIN_ATTEMPTS = 0;
export const DEFAULT_USER_DELETED = false;