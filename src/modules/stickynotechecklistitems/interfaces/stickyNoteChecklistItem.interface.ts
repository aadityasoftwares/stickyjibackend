import type {
    Document,
    Types,
} from "mongoose";

import type {
    StickyNoteChecklistItemStatus,
} from "../constants/stickyNoteChecklistItem.enums.js";

export type StickyNoteChecklistItemSortField =
    | "position"
    | "title"
    | "createdAt"
    | "updatedAt"
    | "completedAt";

export interface IStickyNoteChecklistItem {
    checklistId: Types.ObjectId;
    title: string;
    position: number;
    isCompleted: boolean;
    status: StickyNoteChecklistItemStatus;

    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    completedBy?: Types.ObjectId | null;

    completedAt?: Date | null;
    archivedAt?: Date | null;
    deletedAt?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteChecklistItemDocument
    extends IStickyNoteChecklistItem,
    Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteChecklistItemCreate {
    checklistId: Types.ObjectId | string;
    title: string;
    position?: number;
}

export interface IStickyNoteChecklistItemUpdate {
    title?: string;
    position?: number;
}

export interface IStickyNoteChecklistItemFilter {
    checklistId?: Types.ObjectId | string;
    search?: string;
    status?: StickyNoteChecklistItemStatus;
    isCompleted?: boolean;
    createdBy?: Types.ObjectId | string;
    completedBy?: Types.ObjectId | string;

    page?: number;
    limit?: number;

    sortBy?: StickyNoteChecklistItemSortField;
    sortOrder?: "asc" | "desc";
}

export interface IStickyNoteChecklistItemResponse {
    id: string;
    _id?: string;
    checklistId: string;
    title: string;
    position: number;
    isCompleted: boolean;
    status: StickyNoteChecklistItemStatus;

    createdBy?: string | null;
    updatedBy?: string | null;
    completedBy?: string | null;

    completedAt?: Date | null;
    archivedAt?: Date | null;
    deletedAt?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteChecklistItemPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IStickyNoteChecklistItemPaginatedResult {
    data: IStickyNoteChecklistItemResponse[];
    pagination: IStickyNoteChecklistItemPagination;
}

/**
 * Kept for compatibility/future reorder endpoint.
 */
export interface IStickyNoteChecklistItemReorderItem {
    id: Types.ObjectId | string;
    position: number;
}

export interface IStickyNoteChecklistItemReorder {
    checklistId: Types.ObjectId | string;
    items: IStickyNoteChecklistItemReorderItem[];
}
