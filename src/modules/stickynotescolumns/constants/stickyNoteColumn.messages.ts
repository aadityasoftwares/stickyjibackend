export const StickyNoteColumnMessages = {
    CREATED: "Sticky note column created successfully.",
    DEFAULT_COLUMNS_CREATED: "Default sticky note columns created successfully.",
    FETCHED: "Sticky note column fetched successfully.",
    FETCHED_ALL: "Sticky note columns fetched successfully.",
    UPDATED: "Sticky note column updated successfully.",
    DELETED: "Sticky note column deleted successfully.",
    REORDERED: "Sticky note columns reordered successfully.",

    NOT_FOUND: "Sticky note column not found.",

    WORKSPACE_NOT_FOUND: "Workspace not found.",
    WORKSPACE_DELETED: "Cannot perform this operation because the workspace has been deleted.",
    WORKSPACE_ID_REQUIRED: "Workspace ID is required.",
    INVALID_WORKSPACE_ID: "Invalid workspace ID.",

    WORKSPACE_FOLDER_NOT_FOUND: "Workspace folder not found.",
    WORKSPACE_FOLDER_DELETED: "Cannot perform this operation because the workspace folder has been deleted.",
    WORKSPACE_FOLDER_MISMATCH: "Workspace folder does not belong to the selected workspace.",
    WORKSPACE_FOLDER_ID_REQUIRED: "Workspace folder ID is required.",
    INVALID_WORKSPACE_FOLDER_ID: "Invalid workspace folder ID.",

    INVALID_ID: "Invalid sticky note column ID.",

    NAME_REQUIRED: "Sticky note column name is required.",
    INVALID_NAME: "Invalid sticky note column name.",
    DUPLICATE_NAME: "A sticky note column with this name already exists in this folder.",

    INVALID_COLOR: "Invalid sticky note column color.",
    INVALID_POSITION: "Invalid sticky note column position.",

    MAX_COLUMNS_REACHED: "Maximum number of sticky note columns has been reached for this folder.",

    UPDATE_REQUIRED: "At least one field is required to update the sticky note column.",

    CANNOT_UPDATE_WORKSPACE: "Workspace cannot be changed for an existing sticky note column.",
    CANNOT_UPDATE_WORKSPACE_FOLDER: "Workspace folder cannot be changed for an existing sticky note column.",
    CANNOT_UPDATE_TYPE: "Sticky note column type cannot be changed manually.",
    CANNOT_UPDATE_SYSTEM_FLAG: "Sticky note column system flag cannot be changed manually.",
    CANNOT_UPDATE_POSITION: "Sticky note column position must be changed through the reorder endpoint.",
    CANNOT_UPDATE_CREATED_BY: "Created by cannot be updated.",
    CANNOT_UPDATE_UPDATED_BY: "Updated by cannot be updated.",
    CANNOT_SET_TYPE: "Sticky note column type cannot be set manually.",
    CANNOT_SET_SYSTEM_FLAG: "Sticky note column system flag cannot be set manually.",

    CANNOT_DELETE_SYSTEM_COLUMN: "Default sticky note columns cannot be deleted.",
    DEFAULT_TODO_COLUMN_NOT_FOUND: "Default To do column could not be found.",

    COLUMN_IDS_REQUIRED: "Sticky note column IDs are required.",
    INVALID_COLUMN_IDS: "Sticky note column IDs are invalid.",
    DUPLICATE_COLUMN_IDS: "Duplicate sticky note column IDs are not allowed.",
    REORDER_MUST_INCLUDE_ALL_COLUMNS: "Reorder request must contain every column in the folder exactly once.",
    COLUMN_WORKSPACE_MISMATCH: "One or more sticky note columns do not belong to this workspace and folder.",

    UNSUPPORTED_FIELDS: "Request contains unsupported sticky note column fields.",
    INVALID_USER_ID: "Invalid authenticated user.",
    INVALID_BEFORE_ID: "Invalid before sticky note column ID.",
    INVALID_AFTER_ID: "Invalid after sticky note column ID.",
    BEFORE_COLUMN_NOT_FOUND: "Before sticky note column not found.",
    AFTER_COLUMN_NOT_FOUND: "After sticky note column not found.",
    CANNOT_REORDER_SELF: "A sticky note column cannot reference itself in reorder.",
    IDENTICAL_NEIGHBORS: "Before and after sticky note columns cannot be identical.",
    CANNOT_ACCESS_WORKSPACE: "You do not have access to this workspace.",
    FORBIDDEN: "You do not have permission to perform this action.",
    WORKSPACE_INACTIVE: "Cannot perform this operation because the workspace is inactive or suspended.",
} as const;
