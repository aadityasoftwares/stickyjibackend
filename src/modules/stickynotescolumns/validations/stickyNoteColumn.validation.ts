import { Types } from "mongoose";
import { StickyNoteColumnColor } from "../constants/stickyNoteColumn.enums.js";
import { STICKY_NOTE_COLUMN_CONSTANTS } from "../constants/stickyNoteColumn.constants.js";

const VALID_COLORS = new Set(Object.values(StickyNoteColumnColor));

export const StickyNoteColumnValidation = {
    colors: Object.values(StickyNoteColumnColor),

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && Types.ObjectId.isValid(value);
    },

    isValidColor(value: unknown): value is StickyNoteColumnColor {
        if (typeof value !== "string") return false;
        return (
            VALID_COLORS.has(value as StickyNoteColumnColor) ||
            VALID_COLORS.has(value.toUpperCase() as StickyNoteColumnColor)
        );
    },

    isValidPosition(value: unknown): value is number {
        const num =
            typeof value === "number"
                ? value
                : typeof value === "string" && value.trim() !== ""
                  ? Number(value)
                  : NaN;
        return (
            Number.isFinite(num) &&
            Number.isInteger(num) &&
            num >= STICKY_NOTE_COLUMN_CONSTANTS.POSITION.MIN
        );
    },

    isValidName(value: unknown): value is string {
        if (typeof value !== "string") return false;
        const normalized = this.normalizeName(value);
        return (
            normalized.length >= STICKY_NOTE_COLUMN_CONSTANTS.NAME.MIN_LENGTH &&
            normalized.length <= STICKY_NOTE_COLUMN_CONSTANTS.NAME.MAX_LENGTH
        );
    },

    normalizeName(value: string): string {
        return value.trim().replace(/\s+/g, " ");
    },

    hasOnlyAllowedFields(body: Record<string, unknown>, allowedFields: readonly string[]): boolean {
        return Object.keys(body).every((field) => allowedFields.includes(field));
    },

    hasDuplicateIds(values: string[]): boolean {
        return new Set(values).size !== values.length;
    },
};
