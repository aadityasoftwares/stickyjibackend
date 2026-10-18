import { Types } from "mongoose";

import { StickyNoteAssigneeStatus } from "../constants/stickyNoteAssignee.enums.js";

import type { StickyNoteAssigneeSortField } from "../interfaces/stickyNoteAssignee.interface.js";

const SORT_FIELDS: readonly StickyNoteAssigneeSortField[] = ["assignedAt", "createdAt", "updatedAt"];

export const StickyNoteAssigneeValidation = {
    statuses: Object.values(StickyNoteAssigneeStatus),

    sortFields: SORT_FIELDS,

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && Types.ObjectId.isValid(value);
    },

    isValidStatus(value: unknown): value is StickyNoteAssigneeStatus {
        return typeof value === "string" && this.statuses.includes(value as StickyNoteAssigneeStatus);
    },

    isValidSortField(value: unknown): value is StickyNoteAssigneeSortField {
        return typeof value === "string" && this.sortFields.includes(value as StickyNoteAssigneeSortField);
    },

    isValidSortOrder(value: unknown): value is "asc" | "desc" {
        return value === "asc" || value === "desc";
    },

    isValidPositiveIntegerString(value: unknown): boolean {
        if (typeof value !== "string") {
            return false;
        }

        if (!/^\d+$/.test(value)) {
            return false;
        }

        return Number(value) >= 1;
    },

    normalizeUniqueObjectIds(values: readonly (Types.ObjectId | string)[]): string[] {
        return [...new Set(values.map((value) => String(value).trim()))];
    },
};
