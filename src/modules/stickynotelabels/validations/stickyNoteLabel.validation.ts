import { StickyNoteLabelColor, StickyNoteLabelStatus } from "../constants/stickyNoteLabel.enums.js";

export const StickyNoteLabelValidation = {
    statuses: Object.values(StickyNoteLabelStatus),
    colors: Object.values(StickyNoteLabelColor),

    isValidObjectId(value: unknown): boolean {
        return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
    },

    isValidStatus(value: unknown): value is StickyNoteLabelStatus {
        return typeof value === "string" && this.statuses.includes(value as StickyNoteLabelStatus);
    },

    isValidColor(value: unknown): value is StickyNoteLabelColor {
        return typeof value === "string" && this.colors.includes(value as StickyNoteLabelColor);
    },

    isValidPosition(value: unknown): value is number {
        return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
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
};
