import type {
    Document,
    Types,
} from "mongoose";

import type {
    StickyNoteAssigneeStatus,
} from "../constants/stickyNoteAssignee.enums.js";

export type StickyNoteAssigneeSortField =
    | "assignedAt"
    | "createdAt"
    | "updatedAt";

export interface IStickyNoteAssignee {
    workspaceId: Types.ObjectId;
    stickyNoteId: Types.ObjectId;
    userId: Types.ObjectId;

    status: StickyNoteAssigneeStatus;

    assignedBy: Types.ObjectId;
    removedBy?: Types.ObjectId | null;

    assignedAt: Date;
    removedAt?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteAssigneeDocument
    extends IStickyNoteAssignee,
    Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteAssigneeCreate {
    stickyNoteId: Types.ObjectId | string;
    userId: Types.ObjectId | string;
}

export interface IStickyNoteAssigneeSync {
    assigneeIds: Array<
        Types.ObjectId | string
    >;
}

export interface IStickyNoteAssigneeFilter {
    workspaceId?: Types.ObjectId | string;
    stickyNoteId?: Types.ObjectId | string;
    userId?: Types.ObjectId | string;
    status?: StickyNoteAssigneeStatus;

    page?: number;
    limit?: number;

    sortBy?: StickyNoteAssigneeSortField;
    sortOrder?: "asc" | "desc";
}

export interface IStickyNoteAssigneePagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IStickyNoteAssigneePaginatedResult {
    data: IStickyNoteAssigneeResponse[];
    pagination: IStickyNoteAssigneePagination;
}

export interface IStickyNoteAssigneeUserSummary {
    id: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
}

export interface IStickyNoteAssigneeResponse {
    id: string;
    _id?: string;
    workspaceId: unknown;
    stickyNoteId: unknown;
    userId: unknown;

    status: StickyNoteAssigneeStatus;

    assignedBy: unknown;
    removedBy?: unknown | null;

    assignedAt: Date;
    removedAt?: Date | null;

    createdAt?: Date;
    updatedAt?: Date;
}
