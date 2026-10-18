import type { Document, Types } from "mongoose";
import type { StickyNoteFavoriteStatus } from "../constants/stickyNoteFavorite.enums.js";

export type StickyNoteFavoriteSortField = "createdAt" | "updatedAt";

export interface IStickyNoteFavorite {
    stickyNoteId: Types.ObjectId;
    userId: Types.ObjectId;
    status: StickyNoteFavoriteStatus;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteFavoriteDocument extends IStickyNoteFavorite, Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteFavoriteCreate {
    stickyNoteId: Types.ObjectId | string;
}

export interface IStickyNoteFavoriteFilter {
    userId?: Types.ObjectId | string;
    stickyNoteId?: Types.ObjectId | string;
    status?: StickyNoteFavoriteStatus;
    page?: number;
    limit?: number;
    sortBy?: StickyNoteFavoriteSortField | string;
    sortOrder?: "asc" | "desc";
}

export interface IStickyNoteFavoritePagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IStickyNoteFavoriteResponse {
    id: string;
    _id?: string;
    stickyNoteId: unknown;
    userId: unknown;
    status: StickyNoteFavoriteStatus;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteFavoritePaginatedResult {
    data: IStickyNoteFavoriteResponse[];
    pagination: IStickyNoteFavoritePagination;
}
