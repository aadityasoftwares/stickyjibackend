import {
    StickyNoteChecklistItemStatus,
} from "../constants/stickyNoteChecklistItem.enums.js";

import {
    STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS,
} from "../constants/stickyNoteChecklistItem.constants.js";

import type {
    StickyNoteChecklistItemSortField,
} from "../interfaces/stickyNoteChecklistItem.interface.js";

export const StickyNoteChecklistItemValidation = {
    statuses:
        Object.values(
            StickyNoteChecklistItemStatus,
        ),

    sortFields:
        STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS
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
    ): value is StickyNoteChecklistItemStatus {
        return (
            typeof value ===
            "string" &&
            this.statuses.includes(
                value as StickyNoteChecklistItemStatus,
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

    isValidPosition(
        value: unknown,
    ): value is number {
        return (
            typeof value ===
            "number" &&
            Number.isInteger(
                value,
            ) &&
            Number.isFinite(
                value,
            ) &&
            value >=
            STICKY_NOTE_CHECKLIST_ITEM_CONSTANTS
                .POSITION.MIN
        );
    },

    isValidCompletion(
        value: unknown,
    ): value is boolean {
        return typeof value ===
            "boolean";
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
    ): value is StickyNoteChecklistItemSortField {
        return (
            typeof value ===
            "string" &&
            this.sortFields.includes(
                value as StickyNoteChecklistItemSortField,
            )
        );
    },
};
