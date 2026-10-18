import { PermissionAccess, PermissionAction } from "./permission.enums.js";

export const DEFAULT_PERMISSION_STATUS = true;

export const PERMISSION_CODES = {
    SUBSCRIPTION_ENTITLEMENT_READ: "SUBSCRIPTION_ENTITLEMENT_READ",
    SUBSCRIPTION_ENTITLEMENT_MANAGE: "SUBSCRIPTION_ENTITLEMENT_MANAGE",
    SUBSCRIPTION_USAGE_READ: "SUBSCRIPTION_USAGE_READ",
    SUBSCRIPTION_USAGE_MANAGE: "SUBSCRIPTION_USAGE_MANAGE",
    USER_SUBSCRIPTION_READ: "USER_SUBSCRIPTION_READ",
    USER_SUBSCRIPTION_MANAGE: "USER_SUBSCRIPTION_MANAGE",
    // Workspace
    WORKSPACE_CREATE: "WORKSPACE_CREATE",
    WORKSPACE_READ: "WORKSPACE_READ",
    WORKSPACE_UPDATE: "WORKSPACE_UPDATE",
    WORKSPACE_DELETE: "WORKSPACE_DELETE",
    WORKSPACE_SETTINGS: "WORKSPACE_SETTINGS",
    WORKSPACE_TRANSFER_OWNERSHIP: "WORKSPACE_TRANSFER_OWNERSHIP",

    // Roles
    ROLES_READ: "ROLES_READ",
    ROLES_CREATE: "ROLES_CREATE",
    ROLES_UPDATE: "ROLES_UPDATE",
    ROLES_DELETE: "ROLES_DELETE",
    ROLES_ASSIGN: "ROLES_ASSIGN",

    // Members
    MEMBERS_READ: "MEMBERS_READ",
    MEMBERS_INVITE: "MEMBERS_INVITE",
    MEMBERS_UPDATE_ROLE: "MEMBERS_UPDATE_ROLE",
    MEMBERS_REMOVE: "MEMBERS_REMOVE",

    // Notes
    NOTES_CREATE: "NOTES_CREATE",
    NOTES_READ: "NOTES_READ",

    NOTES_UPDATE_OWN: "NOTES_UPDATE_OWN",
    NOTES_UPDATE_ANY: "NOTES_UPDATE_ANY",

    NOTES_DELETE_OWN: "NOTES_DELETE_OWN",
    NOTES_DELETE_ANY: "NOTES_DELETE_ANY",

    NOTES_ARCHIVE_OWN: "NOTES_ARCHIVE_OWN",
    NOTES_ARCHIVE_ANY: "NOTES_ARCHIVE_ANY",

    NOTES_MOVE_OWN: "NOTES_MOVE_OWN",
    NOTES_MOVE_ANY: "NOTES_MOVE_ANY",

    NOTES_SHARE: "NOTES_SHARE",

    // Folders
    FOLDERS_CREATE: "FOLDERS_CREATE",
    FOLDERS_READ: "FOLDERS_READ",
    FOLDERS_UPDATE: "FOLDERS_UPDATE",
    FOLDERS_DELETE: "FOLDERS_DELETE",

    // Tasks
    TASKS_CREATE: "TASKS_CREATE",
    TASKS_READ: "TASKS_READ",

    TASKS_UPDATE_OWN: "TASKS_UPDATE_OWN",
    TASKS_UPDATE_ANY: "TASKS_UPDATE_ANY",

    TASKS_DELETE_OWN: "TASKS_DELETE_OWN",
    TASKS_DELETE_ANY: "TASKS_DELETE_ANY",
} as const;

export interface PermissionDefinition {
    name: string;
    displayName: string;
    code: string;
    module: string;

    action: PermissionAction;
    access: PermissionAccess;

    description: string;

    sortOrder: number;
}

export const PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
    {
        name: "subscription_usage_read",
        displayName: "View Subscription Usage",
        code: PERMISSION_CODES.SUBSCRIPTION_USAGE_READ,
        module: "SUBSCRIPTION_USAGE",
        action: PermissionAction.READ,
        access: PermissionAccess.ANY,
        description: "Allows authorized global administrators to inspect subscription usage.",
        sortOrder: 790,
    },
    {
        name: "subscription_usage_manage",
        displayName: "Reconcile Subscription Usage",
        code: PERMISSION_CODES.SUBSCRIPTION_USAGE_MANAGE,
        module: "SUBSCRIPTION_USAGE",
        action: PermissionAction.MANAGE,
        access: PermissionAccess.ANY,
        description: "Allows authorized global administrators to reconcile subscription usage counters.",
        sortOrder: 795,
    },
    {
        name: "user_subscription_read",
        displayName: "View User Subscriptions",
        code: PERMISSION_CODES.USER_SUBSCRIPTION_READ,
        module: "USER_SUBSCRIPTION",
        action: PermissionAction.READ,
        access: PermissionAccess.ANY,
        description: "Allows authorized global administrators to inspect personal subscriptions.",
        sortOrder: 800,
    },
    {
        name: "user_subscription_manage",
        displayName: "Reconcile User Subscriptions",
        code: PERMISSION_CODES.USER_SUBSCRIPTION_MANAGE,
        module: "USER_SUBSCRIPTION",
        action: PermissionAction.MANAGE,
        access: PermissionAccess.ANY,
        description: "Allows authorized global administrators to reconcile due subscription states.",
        sortOrder: 810,
    },
    {
        name: "workspace_create",
        displayName: "Create Workspace",
        code: PERMISSION_CODES.WORKSPACE_CREATE,
        module: "WORKSPACE",
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        description: "Allows creating an owned workspace using an application role.",
        sortOrder: 5,
    },

    // =========================================================
    // WORKSPACE
    // =========================================================

    {
        name: "workspace_read",
        displayName: "View Workspace",
        code: PERMISSION_CODES.WORKSPACE_READ,
        module: "WORKSPACE",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing workspace information.",
        sortOrder: 10,
    },

    {
        name: "workspace_update",
        displayName: "Edit Workspace",
        code: PERMISSION_CODES.WORKSPACE_UPDATE,
        module: "WORKSPACE",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.GENERAL,
        description: "Allows updating workspace information.",
        sortOrder: 20,
    },

    {
        name: "workspace_settings",
        displayName: "Manage Workspace Settings",
        code: PERMISSION_CODES.WORKSPACE_SETTINGS,
        module: "WORKSPACE",
        action: PermissionAction.SETTINGS,
        access: PermissionAccess.GENERAL,
        description: "Allows managing workspace settings.",
        sortOrder: 30,
    },

    {
        name: "workspace_delete",
        displayName: "Delete Workspace",
        code: PERMISSION_CODES.WORKSPACE_DELETE,
        module: "WORKSPACE",
        action: PermissionAction.DELETE,
        access: PermissionAccess.GENERAL,
        description: "Allows permanently deleting the workspace.",
        sortOrder: 40,
    },

    {
        name: "workspace_transfer_ownership",
        displayName: "Transfer Ownership",
        code: PERMISSION_CODES.WORKSPACE_TRANSFER_OWNERSHIP,
        module: "WORKSPACE",
        action: PermissionAction.TRANSFER,
        access: PermissionAccess.GENERAL,
        description: "Allows transferring workspace ownership.",
        sortOrder: 50,
    },

    // =========================================================
    // ROLES
    // =========================================================

    {
        name: "roles_read",
        displayName: "View Roles",
        code: PERMISSION_CODES.ROLES_READ,
        module: "ROLES",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing workspace roles and permissions.",
        sortOrder: 10,
    },

    {
        name: "roles_create",
        displayName: "Create Roles",
        code: PERMISSION_CODES.ROLES_CREATE,
        module: "ROLES",
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        description: "Allows creating custom workspace roles.",
        sortOrder: 20,
    },

    {
        name: "roles_update",
        displayName: "Edit Roles",
        code: PERMISSION_CODES.ROLES_UPDATE,
        module: "ROLES",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.GENERAL,
        description: "Allows modifying custom workspace roles.",
        sortOrder: 30,
    },

    {
        name: "roles_delete",
        displayName: "Delete Roles",
        code: PERMISSION_CODES.ROLES_DELETE,
        module: "ROLES",
        action: PermissionAction.DELETE,
        access: PermissionAccess.GENERAL,
        description: "Allows deleting custom workspace roles.",
        sortOrder: 40,
    },

    {
        name: "roles_assign",
        displayName: "Assign Roles",
        code: PERMISSION_CODES.ROLES_ASSIGN,
        module: "ROLES",
        action: PermissionAction.ASSIGN,
        access: PermissionAccess.GENERAL,
        description: "Allows assigning roles to workspace members.",
        sortOrder: 50,
    },

    // =========================================================
    // MEMBERS
    // =========================================================

    {
        name: "members_read",
        displayName: "View Members",
        code: PERMISSION_CODES.MEMBERS_READ,
        module: "MEMBERS",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing workspace members.",
        sortOrder: 10,
    },

    {
        name: "members_invite",
        displayName: "Invite Members",
        code: PERMISSION_CODES.MEMBERS_INVITE,
        module: "MEMBERS",
        action: PermissionAction.INVITE,
        access: PermissionAccess.GENERAL,
        description: "Allows inviting users to the workspace.",
        sortOrder: 20,
    },

    {
        name: "members_update_role",
        displayName: "Change Member Roles",
        code: PERMISSION_CODES.MEMBERS_UPDATE_ROLE,
        module: "MEMBERS",
        action: PermissionAction.ASSIGN,
        access: PermissionAccess.GENERAL,
        description: "Allows changing workspace member roles.",
        sortOrder: 30,
    },

    {
        name: "members_remove",
        displayName: "Remove Members",
        code: PERMISSION_CODES.MEMBERS_REMOVE,
        module: "MEMBERS",
        action: PermissionAction.REMOVE,
        access: PermissionAccess.GENERAL,
        description: "Allows removing members from the workspace.",
        sortOrder: 40,
    },

    // =========================================================
    // NOTES
    // =========================================================

    {
        name: "notes_create",
        displayName: "Create Notes",
        code: PERMISSION_CODES.NOTES_CREATE,
        module: "NOTES",
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        description: "Allows creating notes.",
        sortOrder: 10,
    },

    {
        name: "notes_read",
        displayName: "View Notes",
        code: PERMISSION_CODES.NOTES_READ,
        module: "NOTES",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing notes available inside the workspace.",
        sortOrder: 20,
    },

    {
        name: "notes_update_own",
        displayName: "Edit Own Notes",
        code: PERMISSION_CODES.NOTES_UPDATE_OWN,
        module: "NOTES",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.OWN,
        description: "Allows editing notes created by the current user.",
        sortOrder: 30,
    },

    {
        name: "notes_update_any",
        displayName: "Edit Any Note",
        code: PERMISSION_CODES.NOTES_UPDATE_ANY,
        module: "NOTES",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.ANY,
        description: "Allows editing notes created by any workspace member.",
        sortOrder: 40,
    },

    {
        name: "notes_delete_own",
        displayName: "Delete Own Notes",
        code: PERMISSION_CODES.NOTES_DELETE_OWN,
        module: "NOTES",
        action: PermissionAction.DELETE,
        access: PermissionAccess.OWN,
        description: "Allows deleting notes created by the current user.",
        sortOrder: 50,
    },

    {
        name: "notes_delete_any",
        displayName: "Delete Any Note",
        code: PERMISSION_CODES.NOTES_DELETE_ANY,
        module: "NOTES",
        action: PermissionAction.DELETE,
        access: PermissionAccess.ANY,
        description: "Allows deleting notes created by any workspace member.",
        sortOrder: 60,
    },

    {
        name: "notes_archive_own",
        displayName: "Archive Own Notes",
        code: PERMISSION_CODES.NOTES_ARCHIVE_OWN,
        module: "NOTES",
        action: PermissionAction.ARCHIVE,
        access: PermissionAccess.OWN,
        description: "Allows archiving notes created by the current user.",
        sortOrder: 70,
    },

    {
        name: "notes_archive_any",
        displayName: "Archive Any Note",
        code: PERMISSION_CODES.NOTES_ARCHIVE_ANY,
        module: "NOTES",
        action: PermissionAction.ARCHIVE,
        access: PermissionAccess.ANY,
        description: "Allows archiving notes created by any workspace member.",
        sortOrder: 80,
    },

    {
        name: "notes_move_own",
        displayName: "Move Own Notes",
        code: PERMISSION_CODES.NOTES_MOVE_OWN,
        module: "NOTES",
        action: PermissionAction.MOVE,
        access: PermissionAccess.OWN,
        description: "Allows moving notes created by the current user.",
        sortOrder: 90,
    },

    {
        name: "notes_move_any",
        displayName: "Move Any Note",
        code: PERMISSION_CODES.NOTES_MOVE_ANY,
        module: "NOTES",
        action: PermissionAction.MOVE,
        access: PermissionAccess.ANY,
        description: "Allows moving notes created by any workspace member.",
        sortOrder: 100,
    },

    {
        name: "notes_share",
        displayName: "Share Notes",
        code: PERMISSION_CODES.NOTES_SHARE,
        module: "NOTES",
        action: PermissionAction.SHARE,
        access: PermissionAccess.GENERAL,
        description: "Allows sharing workspace notes.",
        sortOrder: 110,
    },

    // =========================================================
    // FOLDERS
    // =========================================================

    {
        name: "folders_create",
        displayName: "Create Folders",
        code: PERMISSION_CODES.FOLDERS_CREATE,
        module: "FOLDERS",
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        description: "Allows creating workspace folders.",
        sortOrder: 10,
    },

    {
        name: "folders_read",
        displayName: "View Folders",
        code: PERMISSION_CODES.FOLDERS_READ,
        module: "FOLDERS",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing workspace folders.",
        sortOrder: 20,
    },

    {
        name: "folders_update",
        displayName: "Edit Folders",
        code: PERMISSION_CODES.FOLDERS_UPDATE,
        module: "FOLDERS",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.GENERAL,
        description: "Allows updating workspace folders.",
        sortOrder: 30,
    },

    {
        name: "folders_delete",
        displayName: "Delete Folders",
        code: PERMISSION_CODES.FOLDERS_DELETE,
        module: "FOLDERS",
        action: PermissionAction.DELETE,
        access: PermissionAccess.GENERAL,
        description: "Allows deleting workspace folders.",
        sortOrder: 40,
    },

    // =========================================================
    // TASKS
    // =========================================================

    {
        name: "tasks_create",
        displayName: "Create Tasks",
        code: PERMISSION_CODES.TASKS_CREATE,
        module: "TASKS",
        action: PermissionAction.CREATE,
        access: PermissionAccess.GENERAL,
        description: "Allows creating workspace tasks.",
        sortOrder: 10,
    },

    {
        name: "tasks_read",
        displayName: "View Tasks",
        code: PERMISSION_CODES.TASKS_READ,
        module: "TASKS",
        action: PermissionAction.READ,
        access: PermissionAccess.GENERAL,
        description: "Allows viewing workspace tasks.",
        sortOrder: 20,
    },

    {
        name: "tasks_update_own",
        displayName: "Edit Own Tasks",
        code: PERMISSION_CODES.TASKS_UPDATE_OWN,
        module: "TASKS",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.OWN,
        description: "Allows editing tasks created by the current user.",
        sortOrder: 30,
    },

    {
        name: "tasks_update_any",
        displayName: "Edit Any Task",
        code: PERMISSION_CODES.TASKS_UPDATE_ANY,
        module: "TASKS",
        action: PermissionAction.UPDATE,
        access: PermissionAccess.ANY,
        description: "Allows editing tasks created by any workspace member.",
        sortOrder: 40,
    },

    {
        name: "tasks_delete_own",
        displayName: "Delete Own Tasks",
        code: PERMISSION_CODES.TASKS_DELETE_OWN,
        module: "TASKS",
        action: PermissionAction.DELETE,
        access: PermissionAccess.OWN,
        description: "Allows deleting tasks created by the current user.",
        sortOrder: 50,
    },

    {
        name: "tasks_delete_any",
        displayName: "Delete Any Task",
        code: PERMISSION_CODES.TASKS_DELETE_ANY,
        module: "TASKS",
        action: PermissionAction.DELETE,
        access: PermissionAccess.ANY,
        description: "Allows deleting tasks created by any workspace member.",
        sortOrder: 60,
    },
];
