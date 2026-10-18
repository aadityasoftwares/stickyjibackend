import type { Document, Types } from "mongoose";

import type { StickyNoteChecklistStatus } from "../constants/stickyNoteChecklist.enums.js";

export type StickyNoteChecklistSortField = "position" | "title" | "createdAt" | "updatedAt";

export interface IStickyNoteChecklist {
    stickyNoteId: Types.ObjectId;
    title: string;
    position: number;
    status: StickyNoteChecklistStatus;

    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;

    createdAt?: Date;
    updatedAt?: Date;
    archivedAt?: Date | null;
    deletedAt?: Date | null;
}

export interface IStickyNoteChecklistDocument extends IStickyNoteChecklist, Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteChecklistCreate {
    stickyNoteId: Types.ObjectId | string;
    title: string;
    position?: number;
}

export interface IStickyNoteChecklistUpdate {
    title?: string;
    position?: number;
}

export interface IStickyNoteChecklistFilter {
    stickyNoteId?: Types.ObjectId | string;
    search?: string;
    status?: StickyNoteChecklistStatus;
    createdBy?: Types.ObjectId | string;

    page?: number;
    limit?: number;

    sortBy?: StickyNoteChecklistSortField;
    sortOrder?: "asc" | "desc";
}

export interface IStickyNoteChecklistPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IStickyNoteChecklistResponse {
    id: string;
    _id?: string;
    stickyNoteId: string;
    title: string;
    position: number;
    status: StickyNoteChecklistStatus;

    createdBy?: string | null;
    updatedBy?: string | null;

    createdAt?: Date;
    updatedAt?: Date;
    archivedAt?: Date | null;
    deletedAt?: Date | null;
}

export interface IStickyNoteChecklistPaginatedResult {
    data: IStickyNoteChecklistResponse[];
    pagination: IStickyNoteChecklistPagination;
}

/**
 * Kept for API compatibility/future reorder endpoint.
 * Current Angular flow updates positions through the normal update API.
 */
export interface IStickyNoteChecklistReorderItem {
    id: Types.ObjectId | string;
    position: number;
}

export interface IStickyNoteChecklistReorder {
    stickyNoteId: Types.ObjectId | string;
    items: IStickyNoteChecklistReorderItem[];
}
