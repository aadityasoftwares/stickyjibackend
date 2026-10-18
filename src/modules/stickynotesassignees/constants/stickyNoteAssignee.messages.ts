export const StickyNoteAssigneeMessages = {
    CREATED: "Sticky note assignee added successfully.",
    FETCHED: "Sticky note assignee fetched successfully.",
    FETCHED_ALL: "Sticky note assignees fetched successfully.",
    SYNCED: "Sticky note assignees updated successfully.",
    REMOVED: "Sticky note assignee removed successfully.",
    RESTORED: "Sticky note assignee restored successfully.",

    NOT_FOUND: "Sticky note assignee not found.",
    STICKY_NOTE_NOT_FOUND: "Sticky note not found.",
    STICKY_NOTE_NOT_ACTIVE: "Assignees can only be changed on an active sticky note.",
    USER_NOT_FOUND: "User not found.",

    STICKY_NOTE_ID_REQUIRED: "Sticky note ID is required.",
    USER_ID_REQUIRED: "User ID is required.",
    ASSIGNEE_IDS_REQUIRED: "assigneeIds is required.",

    INVALID_ID: "Invalid sticky note assignee ID.",
    INVALID_STICKY_NOTE_ID: "Invalid sticky note ID.",
    INVALID_WORKSPACE_ID: "Invalid workspace ID.",
    INVALID_USER_ID: "Invalid user ID.",
    INVALID_STATUS: "Invalid sticky note assignee status.",
    INVALID_ASSIGNEE_IDS: "assigneeIds must contain valid user IDs.",
    INVALID_PAGE: "Page must be a positive integer.",
    INVALID_LIMIT: "Limit must be a positive integer.",
    INVALID_SORT_FIELD: "Invalid sticky note assignee sort field.",
    INVALID_SORT_ORDER: 'sortOrder must be "asc" or "desc".',

    SCOPE_REQUIRED: "workspaceId or stickyNoteId is required.",
    WORKSPACE_MISMATCH: "Sticky note does not belong to the selected workspace.",
    ACTOR_NOT_ACTIVE_MEMBER: "You are not an active member of this workspace.",
    USER_NOT_ACTIVE_MEMBER: "One or more assignees are not active members of this workspace.",

    MAX_ASSIGNEES_REACHED: "Maximum assignees allowed for this sticky note has been reached.",
    TOO_MANY_ASSIGNEES: "Too many assignees were provided for this sticky note.",

    ALREADY_REMOVED: "Sticky note assignee is already removed.",
    ALREADY_ACTIVE: "Sticky note assignee is already active.",

    REQUEST_BODY_REQUIRED: "Request body is required.",
    UPDATE_REQUIRED: "At least one assignee is required to update assignments.",
} as const;
