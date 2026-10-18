import { Types } from "mongoose";
import {
    StickyNoteFavoriteStatus,
} from "../constants/stickyNoteFavorite.enums.js";
import type {
    StickyNoteFavoriteSortField,
} from "../interfaces/stickyNoteFavorite.interface.js";

const STICKY_NOTE_FAVORITE_SORT_FIELDS: readonly StickyNoteFavoriteSortField[] = [
    "createdAt",
    "updatedAt",
];

export const StickyNoteFavoriteValidation = {
    statuses: Object.values(
        StickyNoteFavoriteStatus,
    ),
    sortFields: STICKY_NOTE_FAVORITE_SORT_FIELDS,

    isValidObjectId(value: unknown): boolean {
        return (
            typeof value === "string" &&
            Types.ObjectId.isValid(value) &&
            /^[a-fA-F0-9]{24}$/.test(value)
        );
    },

    isValidStatus(
        value: unknown,
    ): value is StickyNoteFavoriteStatus {
        return (
            typeof value === "string" &&
            this.statuses.includes(
                value as StickyNoteFavoriteStatus,
            )
        );
    },

    isValidPositiveIntegerString(value: unknown): boolean {
        return (
            typeof value === "string" &&
            /^\d+$/.test(value) &&
            Number(value) >= 1
        );
    },

    isValidSortField(
        value: unknown,
    ): value is StickyNoteFavoriteSortField {
        return (
            typeof value === "string" &&
            this.sortFields.includes(
                value as StickyNoteFavoriteSortField,
            )
        );
    },

    isValidSortOrder(value: unknown): value is "asc" | "desc" {
        return value === "asc" || value === "desc";
    },
};