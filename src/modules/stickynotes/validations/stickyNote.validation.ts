import { Types } from "mongoose";
import { STICKY_NOTE_CONSTANTS } from "../constants/stickyNote.constants.js";
import {
  StickyNoteBackgroundPattern,
  StickyNoteColor,
  StickyNoteDatePreset,
  StickyNotePriority,
  StickyNoteShape,
  StickyNoteStatus,
  StickyNoteVariant,
} from "../constants/stickyNote.enums.js";
import type { StickyNoteSortField } from "../interfaces/stickyNote.interface.js";
const statuses: readonly string[] = Object.values(StickyNoteStatus);
const priorities: readonly string[] = Object.values(StickyNotePriority);
const colors: readonly string[] = Object.values(StickyNoteColor);
const shapes: readonly string[] = Object.values(StickyNoteShape);
const variants: readonly string[] = Object.values(StickyNoteVariant);
const backgroundPatterns: readonly string[] = Object.values(
  StickyNoteBackgroundPattern,
);
const datePresets: readonly string[] = Object.values(StickyNoteDatePreset);
const sortFields: readonly string[] = [
  "createdAt",
  "updatedAt",
  "position",
  "rank",
  "title",
  "noteDate",
  "stickyNoteNumber",
];
export const StickyNoteValidation = {
  statuses,
  priorities,
  colors,
  shapes,
  variants,
  backgroundPatterns,
  datePresets,
  sortFields,
  isValidObjectId(value: unknown): value is string {
    return typeof value === "string" && Types.ObjectId.isValid(value);
  },
  isValidStatus(value: unknown): value is StickyNoteStatus {
    return typeof value === "string" && statuses.includes(value);
  },
  isValidPriority(value: unknown): value is StickyNotePriority {
    return typeof value === "string" && priorities.includes(value);
  },
  isValidColor(value: unknown): value is StickyNoteColor {
    return typeof value === "string" && colors.includes(value);
  },
  isValidShape(value: unknown): value is StickyNoteShape {
    return typeof value === "string" && shapes.includes(value);
  },
  isValidVariant(value: unknown): value is StickyNoteVariant {
    return typeof value === "string" && variants.includes(value);
  },
  isValidBackgroundPattern(
    value: unknown,
  ): value is StickyNoteBackgroundPattern {
    return typeof value === "string" && backgroundPatterns.includes(value);
  },
  isValidDatePreset(value: unknown): value is StickyNoteDatePreset {
    return typeof value === "string" && datePresets.includes(value);
  },
  isValidDateKey(value: unknown): value is string {
    if (
      typeof value !== "string" ||
      !STICKY_NOTE_CONSTANTS.DATE.PATTERN.test(value)
    )
      return false;
    const year = Number(value.slice(0, 4)),
      month = Number(value.slice(5, 7)),
      day = Number(value.slice(8, 10));
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  },
  isValidPosition(value: unknown): value is number {
    return (
      typeof value === "number" &&
      Number.isFinite(value) &&
      Number.isInteger(value)
    );
  },
  isValidPositiveIntegerString(value: unknown): value is string {
    return (
      typeof value === "string" &&
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= 1
    );
  },
  isValidSortField(value: unknown): value is StickyNoteSortField {
    return typeof value === "string" && sortFields.includes(value);
  },
  isValidSortOrder(value: unknown): value is "asc" | "desc" {
    return value === "asc" || value === "desc";
  },
  normalizeTitle(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  },
  normalizeContent(value: string): string {
    return value.trim();
  },
  normalizeSearch(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  },
};
