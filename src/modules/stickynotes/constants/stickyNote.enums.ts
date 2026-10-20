export enum StickyNoteStatus {
    ACTIVE = "ACTIVE",
    ARCHIVED = "ARCHIVED",
    TRASHED = "TRASHED",
}

export enum StickyNotePriority {
    NONE = "NONE",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT",
}

export enum StickyNoteColor {
    WHITE = "WHITE",
    YELLOW = "YELLOW",
    ORANGE = "ORANGE",
    PINK = "PINK",
    RED = "RED",
    GREEN = "GREEN",
    BLUE = "BLUE",
    PURPLE = "PURPLE",
    BROWN = "BROWN",
    BLACK = "BLACK",
}

export enum StickyNoteShape {
    SQUARE = "SQUARE",
    RECTANGLE = "RECTANGLE",
    PORTRAIT = "PORTRAIT",
    LANDSCAPE = "LANDSCAPE",
    STRIP = "STRIP",
}

export enum StickyNoteVariant {
    PLAIN = "PLAIN",
    ROUNDED = "ROUNDED",
    SOFT = "SOFT",
    FOLDED = "FOLDED",
    CUT_CORNER = "CUT_CORNER",
    TICKET = "TICKET",
}

export enum StickyNoteBackgroundPattern {
    NONE = "NONE",
    HORIZONTAL_LINES = "HORIZONTAL_LINES",
    VERTICAL_LINES = "VERTICAL_LINES",
    GRID = "GRID",
}

export enum StickyNoteDatePreset {
    ALL = "ALL",
    TODAY = "TODAY",
    YESTERDAY = "YESTERDAY",
    TOMORROW = "TOMORROW",
    THIS_WEEK = "THIS_WEEK",
    NEXT_WEEK = "NEXT_WEEK",
    THIS_MONTH = "THIS_MONTH",
    NEXT_7_DAYS = "NEXT_7_DAYS",
    PAST = "PAST",
    UPCOMING = "UPCOMING",
    SCHEDULED = "SCHEDULED",
    UNSCHEDULED = "UNSCHEDULED",
}

export enum StickyNoteDateState {
    SCHEDULED = "SCHEDULED",
    UNSCHEDULED = "UNSCHEDULED",
}

export enum StickyNoteOverdueSort {
    OLDEST_FIRST = "OLDEST_FIRST",
    NEWEST_FIRST = "NEWEST_FIRST",
}

export enum StickyNoteView {
    NOTES = "NOTES",
    KANBAN = "KANBAN",
    TABLE = "TABLE",
    GRID = "GRID",
}
