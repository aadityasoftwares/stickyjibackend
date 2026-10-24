import type { Document, Types } from "mongoose";

import type { StickyNoteColumnColor, StickyNoteColumnType } from "../constants/stickyNoteColumn.enums.js";

export interface IStickyNoteColumn {
    workspaceId: Types.ObjectId;
    workspaceFolderId: Types.ObjectId;

    name: string;
    type: StickyNoteColumnType;
    color: StickyNoteColumnColor;

    position: number;
    rank: string;
    isSystem: boolean;

    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStickyNoteColumnDocument extends IStickyNoteColumn, Document {
    _id: Types.ObjectId;
}

export interface IStickyNoteColumnCreate {
    workspaceId: Types.ObjectId | string;
    workspaceFolderId: Types.ObjectId | string;
    name: string;
    color?: StickyNoteColumnColor;
    position?: number;
    rank?: string;
}

export interface IStickyNoteColumnUpdate {
    name?: string;
    color?: StickyNoteColumnColor;
    rank?: string;
}

export interface IStickyNoteColumnReorder {
    workspaceId: Types.ObjectId | string;
    workspaceFolderId: Types.ObjectId | string;
    columnIds: Array<Types.ObjectId | string>;
}

export interface IStickyNoteColumnItemReorder {
    beforeId?: string | null;
    afterId?: string | null;
}

export interface IStickyNoteColumnResponse {
    id: string;
    workspaceId: string;
    workspaceFolderId: string;

    name: string;
    type: StickyNoteColumnType;
    color: StickyNoteColumnColor;

    position: number;
    rank: string;
    isSystem: boolean;

    createdBy: string;
    updatedBy?: string | null;

    createdAt?: Date;
    updatedAt?: Date;
}
