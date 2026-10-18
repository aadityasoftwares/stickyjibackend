import type { Document, Types } from "mongoose";

import type {
    StickyNoteLabelColor,
    StickyNoteLabelStatus,
} from "../constants/stickyNoteLabel.enums.js";

export interface IStickyNoteLabel {
    workspaceId: Types.ObjectId;
    name: string;
    slug: string;
    color: StickyNoteLabelColor;
    position: number;
    status: StickyNoteLabelStatus;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId | null;
    archivedAt?: Date | null;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteLabelDocument
    extends IStickyNoteLabel,
    Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteLabelCreate {
    workspaceId: Types.ObjectId | string;
    name: string;
    slug?: string;
    color?: StickyNoteLabelColor;
    position?: number;
}

export interface IStickyNoteLabelUpdate {
    name?: string;
    slug?: string;
    color?: StickyNoteLabelColor;
    position?: number;
}

export interface IStickyNoteLabelFilter {
    workspaceId?: Types.ObjectId | string;
    search?: string;
    color?: StickyNoteLabelColor;
    status?: StickyNoteLabelStatus;
    createdBy?: Types.ObjectId | string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface IStickyNoteLabelPaginatedResult {
    data: IStickyNoteLabelDocument[];
    total: number;
}