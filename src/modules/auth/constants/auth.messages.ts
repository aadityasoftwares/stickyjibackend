export const AuthMessages = {
    REGISTERED: "Registration successful.",
    LOGIN_SUCCESS: "Login successful.",
    LOGOUT_SUCCESS: "Logout successful.",
    LOGOUT_ALL_SUCCESS:
        "All sessions have been logged out successfully.",
    REFRESH_SUCCESS: "Token refreshed successfully.",

    INVALID_CREDENTIALS: "Invalid email or password.",
    ACCOUNT_NOT_FOUND: "Account not found.",
    ACCOUNT_INACTIVE: "Your account is inactive.",
    ACCOUNT_LOCKED:
        "Your account is temporarily locked. Please try again later.",
    EMAIL_ALREADY_EXISTS:
        "An account with this email already exists.",

    DEFAULT_ROLE_NOT_CONFIGURED:
        "Registration is temporarily unavailable. Default user role is not configured.",

    INVALID_REFRESH_TOKEN:
        "Invalid or expired refresh token.",
    REFRESH_TOKEN_REQUIRED:
        "Refresh token is required.",
    REFRESH_TOKEN_REUSED:
        "Refresh token reuse detected. Please log in again.",

    INVALID_ACCESS_TOKEN:
        "Invalid or expired access token.",

    SESSION_NOT_FOUND: "Session not found.",
    SESSION_REVOKED: "Session has been revoked.",
    SESSION_EXPIRED: "Session has expired.",
    SESSION_INVALID: "Invalid session.",
    SESSIONS_FETCHED:
        "Sessions fetched successfully.",
    SESSION_REFRESH_FAILED:
        "Unable to refresh session.",

    EMAIL_NOT_VERIFIED:
        "Please verify your email address before continuing.",
    INVALID_EMAIL_VERIFICATION_TOKEN:
        "Invalid or expired email verification token.",
    EMAIL_VERIFICATION_SUCCESS:
        "Email verified successfully.",
    EMAIL_VERIFICATION_SENT:
        "Email verification link sent successfully.",

    INVALID_PASSWORD_RESET_TOKEN:
        "Invalid or expired password reset token.",
    PASSWORD_RESET_SUCCESS:
        "Password reset successful.",
    PASSWORD_RESET_EMAIL_SENT:
        "Password reset instructions sent successfully.",
    PASSWORD_CHANGED:
        "Password changed successfully.",
    INVALID_CURRENT_PASSWORD:
        "Current password is incorrect.",

    MFA_REQUIRED:
        "MFA verification is required.",
    MFA_VERIFICATION_SUCCESS:
        "MFA verification successful.",
    INVALID_MFA_CODE:
        "Invalid MFA verification code.",

    EMAIL_REQUIRED: "Email is required.",
    INVALID_EMAIL: "Invalid email.",
    INVALID_EMAIL_ADDRESS:
        "Invalid email address.",

    PASSWORD_REQUIRED: "Password is required.",
    INVALID_PASSWORD: "Invalid password.",

    DEVICE_ID_INVALID: "Invalid device ID.",
    DEVICE_NAME_INVALID: "Invalid device name.",
    SESSION_TYPE_INVALID: "Invalid session type.",

    TERMS_REQUIRED:
        "Terms and conditions must be accepted.",
    PRIVACY_POLICY_REQUIRED:
        "Privacy policy must be accepted.",
} as const;