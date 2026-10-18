import { FeatureCode } from "../../feature/constants/feature.enums.js";

export enum BillingScopeType {
    USER = "USER",
    ORGANIZATION = "ORGANIZATION",
}

export const SubscriptionResource = {
    WORKSPACES: FeatureCode.MAX_WORKSPACES,
    FOLDERS_PER_WORKSPACE: FeatureCode.MAX_FOLDERS_PER_WORKSPACE,
    ACTIVE_STICKY_NOTES: FeatureCode.MAX_ACTIVE_STICKY_NOTES,
    STORAGE_BYTES: FeatureCode.MAX_STORAGE_BYTES,
    UPLOAD_BYTES: FeatureCode.MAX_UPLOAD_BYTES,
    USERS: FeatureCode.MAX_USERS,
} as const;

export type SubscriptionResource = (typeof SubscriptionResource)[keyof typeof SubscriptionResource];
