export const RoleMessages = {
    CREATED: "Role created successfully.",

    UPDATED: "Role updated successfully.",

    DELETED: "Role deleted successfully.",

    FETCHED: "Role fetched successfully.",

    FETCHED_ALL: "Roles fetched successfully.",

    NOT_FOUND: "Role not found.",

    ALREADY_EXISTS: "A role with this name or code already exists in this workspace.",

    SYSTEM_ROLE_DELETE: "System roles cannot be deleted.",

    SYSTEM_ROLE_UPDATE: "System roles cannot be modified.",

    PROTECTED_CODE: "This role code is reserved for a system role.",

    NAME_REQUIRED: "Role name is required.",

    DISPLAY_NAME_REQUIRED: "Role display name is required.",

    CODE_REQUIRED: "Role code is required.",

    WORKSPACE_REQUIRED: "Workspace is required for a workspace role.",

    INVALID_WORKSPACE: "Invalid workspace id.",

    INVALID_TYPE: "Invalid role type.",

    INVALID_SCOPE: "Invalid role scope.",

    CUSTOM_ROLE_ONLY: "Only custom roles can be created through this endpoint.",

    IMMUTABLE_FIELDS:
        "Role type, scope, workspace, system status, default status and priority cannot be changed.",

    INVALID_STATUS: "isActive must be a boolean value.",

    INVALID_PERMISSIONS: "Permissions must be an array.",

    INVALID_PERMISSION: "One or more permissions are invalid or inactive.",

    UPDATE_REQUIRED: "Please provide at least one field to update.",

    ROLE_IN_USE: "Role cannot be deleted because it is assigned to one or more members.",

    ROLE_HAS_INVITATIONS: "Role cannot be deleted because it is assigned to one or more pending invitations.",

    DEFAULT_ROLE_DELETE: "Default roles cannot be deleted.",

    DEFAULT_ROLE_DEACTIVATE: "Default roles cannot be deactivated.",

    CANNOT_MODIFY_HIGHER_ROLE:
        "You cannot modify or delete a role with higher or equal priority than your own.",

    CANNOT_CREATE_HIGHER_PRIORITY: "You cannot create a role with priority higher than or equal to your own.",

    CANNOT_GRANT_UNOWNED_PERMISSIONS: "You cannot grant permissions that your own role does not possess.",

    CANNOT_GRANT_OWNER_PERMISSIONS: "Workspace owner permissions cannot be granted to custom roles.",

    CANNOT_MODIFY_SELF_ROLE: "You cannot modify your own assigned role.",

    WORKSPACE_MISMATCH: "Role does not belong to the specified workspace.",

    ROLE_NOT_ALLOWED: "This role cannot be assigned in this workspace.",
};
