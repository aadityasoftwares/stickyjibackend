import { FeatureCode } from "../../feature/constants/feature.enums.js";

export const RESOURCE_CAPABILITIES: Partial<Record<FeatureCode, FeatureCode>> = {
    [FeatureCode.MAX_WORKSPACES]: FeatureCode.WORKSPACES,
    [FeatureCode.MAX_FOLDERS_PER_WORKSPACE]: FeatureCode.FOLDERS,
    [FeatureCode.MAX_ACTIVE_STICKY_NOTES]: FeatureCode.NOTES,
    [FeatureCode.MAX_STORAGE_BYTES]: FeatureCode.ATTACHMENTS,
    [FeatureCode.MAX_UPLOAD_BYTES]: FeatureCode.ATTACHMENTS,
};

export const SUBSCRIPTION_ENTITLEMENT_CONSTANTS = {
    COLLECTION_NAME: "subscriptionreservations",
    DEFAULT_RESERVATION_TTL_SECONDS: 300, // 5 minutes
    STALE_RESERVATION_CLEANUP_MINUTES: 10,
    QUOTA_RESOURCES: [
        FeatureCode.MAX_WORKSPACES,
        FeatureCode.MAX_FOLDERS_PER_WORKSPACE,
        FeatureCode.MAX_ACTIVE_STICKY_NOTES,
        FeatureCode.MAX_STORAGE_BYTES,
        FeatureCode.MAX_UPLOAD_BYTES,
        FeatureCode.MAX_USERS,
    ],
    // Human-friendly labels for each resource code in error messages
    RESOURCE_LABELS: {
        [FeatureCode.MAX_WORKSPACES]: "workspaces",
        [FeatureCode.MAX_FOLDERS_PER_WORKSPACE]: "folders per workspace",
        [FeatureCode.MAX_ACTIVE_STICKY_NOTES]: "active sticky notes",
        [FeatureCode.MAX_STORAGE_BYTES]: "storage bytes",
        [FeatureCode.MAX_UPLOAD_BYTES]: "upload file size bytes",
        [FeatureCode.MAX_USERS]: "users",
    } as Record<string, string>,
};
