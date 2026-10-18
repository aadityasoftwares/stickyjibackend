export const WorkspaceMemberMessages = {
    CREATED: "Workspace member added successfully.",
    UPDATED: "Workspace member updated successfully.",
    FETCHED: "Workspace member fetched successfully.",
    FETCHED_ALL: "Workspace members fetched successfully.",
    REMOVED: "Workspace member removed successfully.",
    RESTORED: "Workspace member restored successfully.",
    ROLE_ASSIGNED: "Workspace member role assigned successfully.",

    CREATE_REQUIRED: "Workspace member data is required.",
    UPDATE_REQUIRED: "Workspace member update data is required.",
    WORKSPACE_ID_REQUIRED: "Workspace ID is required.",
    USER_ID_REQUIRED: "User ID is required.",
    ROLE_ID_REQUIRED: "Role ID is required.",

    INVALID_WORKSPACE_ID: "Invalid workspace ID.",
    INVALID_USER_ID: "Invalid user ID.",
    INVALID_ROLE_ID: "Invalid role ID.",
    INVALID_STATUS: "Invalid workspace member status.",

    NOT_FOUND: "Workspace member not found.",
    WORKSPACE_NOT_FOUND: "Workspace not found.",
    ACCESS_DENIED: "You do not have access to view members of this workspace.",
    USER_NOT_FOUND: "User not found.",
    ROLE_NOT_FOUND: "Role not found.",
    ALREADY_EXISTS: "User is already a member of this workspace.",

    ROLE_NOT_ALLOWED: "The selected role cannot be assigned in this workspace.",
    CANNOT_CHANGE_OWNER_ROLE: "Workspace owner role cannot be changed.",
    CANNOT_REMOVE_OWNER: "Workspace owner cannot be removed.",
    CANNOT_ADD_OWNER: "Workspace owner membership is managed automatically.",
    CANNOT_ADD_MEMBERS_TO_PERSONAL_WORKSPACE: "Members cannot be added to a personal workspace.",

    CANNOT_UPDATE_WORKSPACE_ID: "Workspace ID cannot be updated.",
    CANNOT_UPDATE_USER_ID: "User ID cannot be updated.",
    CANNOT_UPDATE_STATUS: "Member status cannot be updated directly.",
    CANNOT_UPDATE_INVITED_BY: "Invited by cannot be updated.",
    CANNOT_UPDATE_JOINED_AT: "Joined date cannot be updated.",
    CANNOT_UPDATE_CREATED_BY: "Created by cannot be updated.",
    CANNOT_UPDATE_UPDATED_BY: "Updated by cannot be updated.",

    UNSUPPORTED_CREATE_FIELDS: "Request contains unsupported workspace member fields.",
    UNSUPPORTED_UPDATE_FIELDS: "Request contains unsupported workspace member update fields.",

    CANNOT_MANAGE_HIGHER_ROLE: "You cannot modify a member with equal or higher role priority.",
    CANNOT_ASSIGN_HIGHER_ROLE: "You cannot assign a role with equal or higher priority than your own.",
    CANNOT_REMOVE_SELF: "Workspace members cannot remove themselves.",
    FORBIDDEN_MANAGE_MEMBERS: "You do not have permission to manage members in this workspace.",
} as const;
