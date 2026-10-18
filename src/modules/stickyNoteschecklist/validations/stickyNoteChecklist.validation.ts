import {
    StickyNoteChecklistStatus,
} from "../constants/stickyNoteChecklist.enums.js";

import {
    STICKY_NOTE_CHECKLIST_CONSTANTS,
} from "../constants/stickyNoteChecklist.constants.js";

import type {
    StickyNoteChecklistSortField,
} from "../interfaces/stickyNoteChecklist.interface.js";

export const StickyNoteChecklistValidation = {
    statuses:
        Object.values(
            StickyNoteChecklistStatus,
        ),

    sortFields:
        STICKY_NOTE_CHECKLIST_CONSTANTS
            .SORT_FIELDS,

    isValidObjectId(
        value: unknown,
    ): boolean {
        return (
            typeof value ===
            "string" &&
            /^[a-fA-F0-9]{24}$/.test(
                value,
            )
        );
    },

    isValidStatus(
        value: unknown,
    ): value is StickyNoteChecklistStatus {
        return (
            typeof value ===
            "string" &&
            this.statuses.includes(
                value as StickyNoteChecklistStatus,
            )
        );
    },

    isValidPosition(
        value: unknown,
    ): value is number {
        return (
            typeof value ===
            "number" &&
            Number.isFinite(
                value,
            ) &&
            Number.isInteger(
                value,
            ) &&
            value >=
            STICKY_NOTE_CHECKLIST_CONSTANTS
                .POSITION.MIN
        );
    },

    isPositiveInteger(
        value: unknown,
    ): boolean {
        const numberValue =
            Number(
                value,
            );

        return (
            Number.isInteger(
                numberValue,
            ) &&
            numberValue >
            0
        );
    },

    isValidSortField(
        value: unknown,
    ): value is StickyNoteChecklistSortField {
        return (
            typeof value ===
            "string" &&
            this.sortFields.includes(
                value as StickyNoteChecklistSortField,
            )
        );
    },

    normalizeTitle(
        value: string,
    ): string {
        return value
            .trim()
            .replace(
                /\s+/g,
                " ",
            );
    },
};
