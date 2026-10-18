export const StickyNoteChecklistItemMessages = {
    CREATED: "Sticky note checklist item created successfully.",
    FETCHED: "Sticky note checklist item fetched successfully.",
    FETCHED_ALL: "Sticky note checklist items fetched successfully.",
    UPDATED: "Sticky note checklist item updated successfully.",
    DELETED: "Sticky note checklist item deleted successfully.",
    RESTORED: "Sticky note checklist item restored successfully.",
    ARCHIVED: "Sticky note checklist item archived successfully.",
    UNARCHIVED: "Sticky note checklist item unarchived successfully.",
    STATUS_UPDATED: "Sticky note checklist item status updated successfully.",
    REORDERED: "Sticky note checklist items reordered successfully.",
    COMPLETED: "Sticky note checklist item completed successfully.",
    UNCOMPLETED: "Sticky note checklist item marked as incomplete successfully.",

    NOT_FOUND: "Sticky note checklist item not found.",
    CHECKLIST_NOT_FOUND: "Sticky note checklist not found.",
    CHECKLIST_DELETED:
        "Cannot perform this operation because the checklist has been deleted.",

    ALREADY_EXISTS:
        "A sticky note checklist item with this title already exists.",

    INVALID_ID: "Invalid sticky note checklist item ID.",
    INVALID_CHECKLIST_ID: "Invalid sticky note checklist ID.",
    CHECKLIST_ID_REQUIRED: "Sticky note checklist ID is required.",

    TITLE_REQUIRED: "Sticky note checklist item title is required.",
    INVALID_TITLE: "Invalid sticky note checklist item title.",
    INVALID_POSITION: "Invalid sticky note checklist item position.",
    INVALID_COMPLETION_STATUS: "Invalid checklist item completion status.",
    INVALID_STATUS: "Invalid sticky note checklist item status.",
    INVALID_PAGE: "Page must be a positive integer.",
    INVALID_LIMIT: "Limit must be a positive integer.",
    INVALID_SEARCH: "Invalid checklist item search value.",
    INVALID_SORT: "Invalid checklist item sort field.",
    INVALID_SORT_ORDER: "Sort order must be asc or desc.",
    INVALID_CREATED_BY: "Invalid createdBy user ID.",
    INVALID_COMPLETED_BY: "Invalid completedBy user ID.",
    INVALID_USER_ID: "Invalid authenticated user.",
    INVALID_FIELD: "One or more request fields are not supported.",

    UPDATE_REQUIRED:
        "At least one field is required to update the sticky note checklist item.",
    CANNOT_UPDATE_CHECKLIST:
        "Checklist cannot be changed for an existing checklist item.",
    CANNOT_UPDATE_CREATED_BY: "Created by cannot be updated.",
    CANNOT_UPDATE_UPDATED_BY: "Updated by cannot be updated.",
    CANNOT_UPDATE_STATUS:
        "Checklist item status must be updated through the status endpoint.",
    CANNOT_SET_STATUS:
        "Checklist item status cannot be set during creation.",
    CANNOT_UPDATE_COMPLETION:
        "Checklist item completion must be updated through the completion endpoint.",
    CANNOT_SET_COMPLETION:
        "Checklist item completion cannot be set during creation.",
    CANNOT_DELETE_THROUGH_STATUS:
        "Use the delete endpoint to delete a sticky note checklist item.",

    ALREADY_COMPLETED: "Sticky note checklist item is already completed.",
    ALREADY_INCOMPLETE: "Sticky note checklist item is already incomplete.",
    ALREADY_ARCHIVED: "Sticky note checklist item is already archived.",
    ALREADY_ACTIVE: "Sticky note checklist item is already active.",
    ALREADY_DELETED: "Sticky note checklist item is already deleted.",
    CANNOT_RESTORE_ACTIVE: "Sticky note checklist item is already active.",
    RESTORE_CONFLICT:
        "A checklist item with the same title already exists in this checklist.",

    NO_ITEMS_FOUND: "No sticky note checklist items found.",
    MAX_ITEMS_REACHED:
        "The maximum number of items for this checklist has been reached.",
} as const;
