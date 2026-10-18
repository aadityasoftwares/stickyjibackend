export const USER_WORKSPACE_CONSTANTS = {
    WORKSPACE: {
        NAME: "My Workspace",
        SLUG_PREFIX: "personal",
        DESCRIPTION: "Your personal workspace",
    },

    DEFAULT_FOLDER: {
        NAME: "My Notes",
        SLUG_PREFIX: "my-notes",
        DESCRIPTION: "Your default notes folder",
        POSITION: 0,
    },

    DEFAULT_NOTE: {
        TITLE: "My First Note",
        CONTENT:
            "Welcome This is your first sticky note. Edit it, move it between columns, or create a new note.",
        POSITION: 0,
    },
} as const;
