export const SubscriptionEntitlementMessages = {
    FETCHED_SUCCESSFULLY: "Entitlements fetched successfully.",
    CHECK_SUCCESSFUL: "Resource check completed successfully.",
    LIMIT_EXCEEDED: (resource: string, limit: number): string =>
        `You have reached the maximum of ${limit} ${resource} on your current plan.`,
    WORKSPACE_LIMIT_EXCEEDED: (limit: number): string =>
        `You have reached the maximum of ${limit} workspaces on your current plan.`,
    FOLDER_LIMIT_EXCEEDED: (limit: number): string =>
        `You have reached the maximum of ${limit} folders for this workspace on your current plan.`,
    NOTE_LIMIT_EXCEEDED: (limit: number): string =>
        `You have reached the maximum of ${limit} active sticky notes on your current plan.`,
    FILE_SIZE_EXCEEDED: (limitBytes: number): string =>
        `File size exceeds the maximum allowed upload limit of ${limitBytes} bytes on your current plan.`,
    STORAGE_EXCEEDED: (limitBytes: number): string =>
        `Storage capacity exceeded. Your plan allows up to ${limitBytes} bytes.`,
    USER_LIMIT_EXCEEDED: (limit: number): string => `User limit of ${limit} reached on your current plan.`,
    CONFIGURATION_ERROR:
        "Required subscription plan configuration or resource limits are missing or malformed.",
    SUBSCRIPTION_UNAVAILABLE: "Unable to resolve active subscription for this account.",
    INVALID_RESOURCE: "The requested resource is not a valid subscription quota resource.",
    INVALID_SCOPE: "Invalid billing scope provided.",
    INVALID_USER_ID: "Invalid user ID provided.",
    INVALID_WORKSPACE_ID: "Invalid workspace ID provided.",
    INVALID_NOTE_ID: "Invalid note ID provided.",
    INVALID_FOLDER_ID: "Invalid folder ID provided.",
    INVALID_QUANTITY: "Requested quantity must be a positive integer.",
    UNAUTHORIZED_ACCESS: "You do not have permission to access or mutate resources in this billing scope.",
    WORKSPACE_NOT_FOUND: "Workspace not found.",
    FOLDER_NOT_FOUND: "Folder not found.",
    NOTE_NOT_FOUND: "Sticky note not found.",
    RESERVATION_NOT_FOUND: "Subscription reservation not found or already completed.",
    RESERVATION_EXPIRED: "Subscription reservation has expired.",
};
