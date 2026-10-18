import { WorkspaceStatus, WorkspaceVisibility } from "../constants/workspace.enums.js";
import { WORKSPACE_CONSTANTS } from "../constants/workspace.constants.js";
import type { WorkspaceSortField } from "../interfaces/workspace.interface.js";

export const WorkspaceValidation = {
    statuses: Object.values(WorkspaceStatus),
    visibilities: Object.values(WorkspaceVisibility),
    sortFields: WORKSPACE_CONSTANTS.SORT_FIELDS,

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidStatus(value: unknown): value is WorkspaceStatus {
        return typeof value === "string" && this.statuses.includes(value as WorkspaceStatus);
    },

    isValidVisibility(value: unknown): value is WorkspaceVisibility {
        return typeof value === "string" && this.visibilities.includes(value as WorkspaceVisibility);
    },

    normalizeName(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    },

    normalizeSlug(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    },

    isValidSlug(value: unknown): boolean {
        return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
    },

    isPositiveInteger(value: unknown): boolean {
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0;
    },

    isValidSortField(value: unknown): value is WorkspaceSortField {
        return typeof value === "string" && this.sortFields.includes(value as WorkspaceSortField);
    },

    hasOnlyAllowedFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
        return Object.keys(body).every((field) => allowedFields.includes(field));
    },
};
