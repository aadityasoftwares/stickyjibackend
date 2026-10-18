export const StickyNoteFavoriteMessages = {
    CREATED: "Sticky note added to favorites successfully.",
    FETCHED: "Sticky note favorite fetched successfully.",
    FETCHED_ALL: "Sticky note favorites fetched successfully.",
    DELETED: "Sticky note removed from favorites successfully.",
    RESTORED: "Sticky note favorite restored successfully.",

    NOT_FOUND: "Sticky note favorite not found.",
    STICKY_NOTE_NOT_FOUND: "Sticky note not found.",

    ALREADY_FAVORITED: "Sticky note is already in favorites.",
    NOT_FAVORITED: "Sticky note is not in favorites.",
    ALREADY_DELETED: "Sticky note favorite is already deleted.",

    INVALID_ID: "Invalid sticky note favorite ID.",
    INVALID_STICKY_NOTE_ID: "Invalid sticky note ID.",
    STICKY_NOTE_ID_REQUIRED: "Sticky note ID is required.",
    USER_ID_REQUIRED: "User ID is required.",

    CANNOT_UPDATE_STICKY_NOTE:
        "Sticky note cannot be changed for an existing favorite.",

    CANNOT_UPDATE_USER:
        "User cannot be changed for an existing favorite.",

    NO_FAVORITES_FOUND: "No sticky note favorites found.",
    INVALID_STATUS: "Invalid sticky note favorite status.",

    CANNOT_UPDATE_STATUS:
        "Favorite status must be managed through the favorite endpoints.",
} as const;