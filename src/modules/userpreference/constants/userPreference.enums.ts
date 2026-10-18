export enum UserPreferenceCategory {
    APPEARANCE = "APPEARANCE",
    NOTES = "NOTES",
    WORKSPACE = "WORKSPACE",
    EDITOR = "EDITOR",
    NOTIFICATIONS = "NOTIFICATIONS",
    PRIVACY = "PRIVACY",
    ACCESSIBILITY = "ACCESSIBILITY",
    GENERAL = "GENERAL",
    LOCALIZATION = "LOCALIZATION",
}

export enum UserPreferenceValueType {
    STRING = "STRING",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",
    JSON = "JSON",
}

export { StickyNoteView } from "../../stickynotes/constants/stickyNote.enums.js";
export { WorkspaceAccessFilter } from "../../workspace/constants/workspace.enums.js";