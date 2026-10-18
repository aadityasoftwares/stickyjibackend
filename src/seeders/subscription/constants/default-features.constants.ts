import {
    FeatureCode,
    FeatureCategory,
    FeatureType,
} from "../../../modules/feature/constants/feature.enums.js";

// Capability granularity follows the existing catalog. Notes includes checklists,
// styling, priorities, archive/trash, filters and bulk actions.
const capabilities = [
    [
        FeatureCode.WORKSPACES,
        "Workspaces",
        "Workspace organization and collaboration.",
        FeatureCategory.CORE,
        true,
    ],
    [
        FeatureCode.FOLDERS,
        "Folders",
        "Folder organization within each workspace.",
        FeatureCategory.CORE,
        true,
    ],
    [
        FeatureCode.NOTES,
        "Notes",
        "Sticky notes, checklists, styling, priorities, archive, trash and bulk actions.",
        FeatureCategory.CORE,
        true,
    ],
    [
        FeatureCode.MEMBERS,
        "Members",
        "Workspace collaboration under existing role permissions.",
        FeatureCategory.COLLABORATION,
        true,
    ],
    [
        FeatureCode.KANBAN,
        "Kanban",
        "Sticky-note columns and board organization.",
        FeatureCategory.PRODUCTIVITY,
        true,
    ],
    [
        FeatureCode.ATTACHMENTS,
        "Attachments",
        "Attachment uploads and media management.",
        FeatureCategory.STORAGE,
        true,
    ],
    [
        FeatureCode.ADVANCED_SEARCH,
        "Search and filters",
        "Existing note search and filters.",
        FeatureCategory.PRODUCTIVITY,
        true,
    ],
    [
        FeatureCode.SHARED_NOTES,
        "Shared notes",
        "Notes accessible to authorized workspace members.",
        FeatureCategory.COLLABORATION,
        true,
    ],
    [
        FeatureCode.SHARED_FOLDERS,
        "Shared folders",
        "Folders accessible to authorized workspace members.",
        FeatureCategory.COLLABORATION,
        true,
    ],
    [
        FeatureCode.MEMBER_ROLES,
        "Member roles",
        "Workspace membership and role management.",
        FeatureCategory.COLLABORATION,
        true,
    ],
    [
        FeatureCode.ACTIVITY_LOG,
        "Activity log",
        "Existing audit history subject to authorization.",
        FeatureCategory.COLLABORATION,
        true,
    ],
    [
        FeatureCode.REMINDERS,
        "Reminders",
        "Reserved until reminder delivery is implemented.",
        FeatureCategory.PRODUCTIVITY,
        false,
    ],
    [
        FeatureCode.EXPORT,
        "Export",
        "Reserved until a product export API is implemented.",
        FeatureCategory.PRODUCTIVITY,
        false,
    ],
    [
        FeatureCode.NOTE_HISTORY,
        "Note history",
        "Reserved until note version history is implemented.",
        FeatureCategory.PRODUCTIVITY,
        false,
    ],
    [
        FeatureCode.ADS_FREE,
        "Ad free",
        "Inactive legacy advertising capability; never a paid-only benefit.",
        FeatureCategory.MONETIZATION,
        false,
    ],
] as const;

export const DEFAULT_SUBSCRIPTION_FEATURES = capabilities.map(
    ([code, name, description, category, isActive]) => ({
        code,
        name,
        description,
        category,
        isActive,
        type: FeatureType.BOOLEAN,
        isDefault: isActive,
        isSystem: true,
    }),
);
