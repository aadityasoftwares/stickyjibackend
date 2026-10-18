import { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";
import { WORKSPACE_FOLDER_CONSTANTS } from "../constants/workspaceFolder.constants.js";
import type { WorkspaceFolderSortField } from "../interfaces/workspaceFolder.interface.js";

export const WorkspaceFolderValidation = {
    statuses: Object.values(WorkspaceFolderStatus),
    sortFields: WORKSPACE_FOLDER_CONSTANTS.SORT_FIELDS,

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidStatus(value: unknown): value is WorkspaceFolderStatus {
        return typeof value === "string" && this.statuses.includes(value as WorkspaceFolderStatus);
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

    isValidColor(value: unknown): boolean {
        if (typeof value !== "string") {
            return false;
        }
        const color = value.trim();
        return color.length > 0 && /^#[a-fA-F0-9]{3,8}$/.test(color);
    },

    isValidPosition(value: unknown): value is number {
        return (
            typeof value === "number" &&
            Number.isInteger(value) &&
            Number.isFinite(value) &&
            value >= WORKSPACE_FOLDER_CONSTANTS.POSITION.MIN
        );
    },

    isPositiveInteger(value: unknown): boolean {
        const numberValue = Number(value);
        return Number.isInteger(numberValue) && numberValue > 0;
    },

    isValidSortField(value: unknown): value is WorkspaceFolderSortField {
        return typeof value === "string" && this.sortFields.includes(value as WorkspaceFolderSortField);
    },

    hasOnlyAllowedFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
        return Object.keys(body).every((field) => allowedFields.includes(field));
    },
};
