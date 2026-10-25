import type { Document, Types } from "mongoose";
import type { StickyNoteFavoriteStatus } from "../constants/stickyNoteFavorite.enums.js";
import type { IStickyNoteListItemResponse } from "../../stickynotes/interfaces/stickynote.interface.js";

export type StickyNoteFavoriteSortField = "createdAt" | "updatedAt" | "title" | "position";

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
    workspaceId?: Types.ObjectId | string;
    workspaceFolderId?: Types.ObjectId | string;
    search?: string;
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

export interface IStickyNoteFavoriteResponse extends Partial<IStickyNoteListItemResponse> {
    id: string;
    _id?: string;
    stickyNoteId: string | unknown;
    userId: string | unknown;
    status: StickyNoteFavoriteStatus;
    isFavorite: boolean;
    favoriteId: string;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    stickyNote?: IStickyNoteListItemResponse | null;
}

export interface IStickyNoteFavoritePaginatedResult {
    data: IStickyNoteFavoriteResponse[];
    pagination: IStickyNoteFavoritePagination;
}
