import { AuditLogAction } from "../modules/auditlog/constants/auditLog.enums.js";
import { AppModule } from "../utils/enums/appModule.enums.js";

export interface IAuditLogModuleConfig {
    resourceType: string;
    actions: AuditLogAction[];
}

export const AuditLogConfig: Partial<Record<AppModule, IAuditLogModuleConfig>> = {
    [AppModule.SUBSCRIPTION_ENTITLEMENT]: {
        resourceType: "SubscriptionEntitlement",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.STATUS_CHANGE],
    },

    [AppModule.SUBSCRIPTION_USAGE]: {
        resourceType: "SubscriptionUsage",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.STATUS_CHANGE],
    },

    [AppModule.USER_SUBSCRIPTION]: {
        resourceType: "UserSubscription",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.STATUS_CHANGE],
    },

    [AppModule.AUTH]: {
        resourceType: "Authentication",
        actions: [
            AuditLogAction.REGISTER,

            AuditLogAction.LOGIN,
            AuditLogAction.LOGOUT,
            AuditLogAction.LOGOUT_ALL,
            AuditLogAction.LOGIN_FAILED,

            AuditLogAction.PASSWORD_CHANGED,
            AuditLogAction.PASSWORD_RESET,
            AuditLogAction.PASSWORD_RESET_REQUESTED,

            AuditLogAction.EMAIL_VERIFIED,
            AuditLogAction.PHONE_VERIFIED,

            AuditLogAction.MFA_ENABLED,
            AuditLogAction.MFA_DISABLED,
        ],
    },

    [AppModule.USER]: {
        resourceType: "User",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.RESTORE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.LOGIN,
            AuditLogAction.LOGOUT,
            AuditLogAction.LOGIN_FAILED,
            AuditLogAction.PASSWORD_CHANGED,
            AuditLogAction.PASSWORD_RESET,
            AuditLogAction.EMAIL_VERIFIED,
            AuditLogAction.PHONE_VERIFIED,
            AuditLogAction.MFA_ENABLED,
            AuditLogAction.MFA_DISABLED,
            AuditLogAction.ROLE_ASSIGNED,
            AuditLogAction.PERMISSION_ASSIGNED,
            AuditLogAction.PERMISSION_REVOKED,
        ],
    },

    [AppModule.ROLE]: {
        resourceType: "Role",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.PERMISSION]: {
        resourceType: "Permission",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.FEATURE]: {
        resourceType: "Feature",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.PLAN]: {
        resourceType: "Plan",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.PLAN_PRICE]: {
        resourceType: "Plan Price",

        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.PLAN_FEATURE]: {
        resourceType: "Plan Feature",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
        ],
    },

    [AppModule.COUNTRY]: {
        resourceType: "Country",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.TIMEZONE]: {
        resourceType: "Timezone",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.CURRENCY]: {
        resourceType: "Currency",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.LANGUAGE]: {
        resourceType: "Language",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.LOCALIZATION]: {
        resourceType: "Localization",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.DELETE],
    },

    [AppModule.SYSTEM_SETTING]: {
        resourceType: "System Setting",
        actions: [AuditLogAction.UPDATE],
    },

    [AppModule.WORKSPACE]: {
        resourceType: "Workspace",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.RESTORE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
        ],
    },

    [AppModule.WORKSPACE_MEMBER]: {
        resourceType: "Workspace Member",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.ASSIGN,
            AuditLogAction.ROLE_ASSIGNED,
            AuditLogAction.REMOVE,
            AuditLogAction.RESTORE,
        ],
    },

    [AppModule.WORKSPACE_FOLDER]: {
        resourceType: "Workspace Folder",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
            AuditLogAction.RESTORE,
        ],
    },

    [AppModule.USERPROFILE]: {
        resourceType: "User Profile",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.MEDIA]: {
        resourceType: "Media",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
        ],
    },

    [AppModule.USER_PREFERENCE]: {
        resourceType: "User Preference",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.DELETE, AuditLogAction.RESET],
    },

    [AppModule.STICKY_NOTE]: {
        resourceType: "Sticky Note",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
        ],
    },

    [AppModule.STICKY_NOTE_COLUMN]: {
        resourceType: "Sticky Note Column",
        actions: [AuditLogAction.CREATE, AuditLogAction.UPDATE, AuditLogAction.DELETE],
    },

    [AppModule.STICKY_NOTE_LABEL]: {
        resourceType: "Sticky Note Label",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
        ],
    },

    [AppModule.STICKY_NOTE_CHECKLIST]: {
        resourceType: "Sticky Note Checklist",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
        ],
    },

    [AppModule.STICKY_NOTE_CHECKLIST_ITEM]: {
        resourceType: "Sticky Note Checklist Item",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
            AuditLogAction.COMPLETE,
            AuditLogAction.UNCOMPLETE,
            AuditLogAction.REORDER,
        ],
    },

    [AppModule.STICKY_NOTE_FAVORITE]: {
        resourceType: "Sticky Note Favorite",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
        ],
    },

    [AppModule.STICKY_NOTE_ASSIGNEE]: {
        resourceType: "Sticky Note Assignee",
        actions: [
            AuditLogAction.CREATE,
            AuditLogAction.UPDATE,
            AuditLogAction.DELETE,
            AuditLogAction.STATUS_CHANGE,
            AuditLogAction.RESTORE,
            AuditLogAction.ASSIGN,
            AuditLogAction.REMOVE,
        ],
    },

    [AppModule.AUDIT_LOG]: {
        resourceType: "Audit Log",
        actions: [],
    },
};
