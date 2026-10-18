import { StickyNoteColumnColor, StickyNoteColumnType } from "./stickyNoteColumn.enums.js";

export const STICKY_NOTE_COLUMN_CONSTANTS = {
    NAME: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 50,
    },

    POSITION: {
        MIN: 0,
        DEFAULT: 0,
    },

    /**
     * Columns are scoped by workspace + workspace folder.
     * The legacy constant is kept to avoid breaking existing imports.
     */
    MAX_COLUMNS_PER_FOLDER: 20,
    MAX_COLUMNS_PER_WORKSPACE: 20,
} as const;

export const DEFAULT_STICKY_NOTE_COLUMNS = [
    {
        name: "To do",
        type: StickyNoteColumnType.TODO,
        color: StickyNoteColumnColor.YELLOW,
        position: 0,
        rank: "00100000",
        isSystem: true,
    },
    {
        name: "Doing",
        type: StickyNoteColumnType.IN_PROGRESS,
        color: StickyNoteColumnColor.BLUE,
        position: 1,
        rank: "00200000",
        isSystem: true,
    },
    {
        name: "Done",
        type: StickyNoteColumnType.COMPLETED,
        color: StickyNoteColumnColor.GREEN,
        position: 2,
        rank: "00300000",
        isSystem: true,
    },
] as const;
