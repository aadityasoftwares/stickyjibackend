import type { Document, Types } from "mongoose";
import type { WorkspaceFolderStatus } from "../constants/workspaceFolder.enums.js";

export type WorkspaceFolderSortField =
    | "position"
    | "name"
    | "slug"
    | "createdAt"
    | "updatedAt";

export interface IWorkspaceFolder {
    workspaceId: Types.ObjectId;
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    position: number;
    isDefault: boolean;
    status: WorkspaceFolderStatus;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    deletedAt?: Date | null;
    deletedBy?: Types.ObjectId | null;
    purgeAfter?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceFolderDocument extends IWorkspaceFolder, Document {
    _id: Types.ObjectId;
}

export interface IWorkspaceFolderCreate {
    workspaceId: Types.ObjectId | string;
    name: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    position?: number;
    isDefault?: boolean;
}

export interface IWorkspaceFolderUpdate {
    name?: string;
    slug?: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    position?: number;
}

export interface IWorkspaceFolderFilter {
    workspaceId?: Types.ObjectId | string;
    search?: string;
    status?: WorkspaceFolderStatus | "ALL";
    isDefault?: boolean;
    createdBy?: Types.ObjectId | string;
    page?: number;
    limit?: number;
    sortBy?: WorkspaceFolderSortField;
    sortOrder?: "asc" | "desc";
}

export interface IWorkspaceFolderSummary {
    stickyNoteCount: number;
    stickyNotesCount: number;
    total: number;
    active: number;
    archived: number;
}

export interface IWorkspaceFolderAllowedActions {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canChangeStatus: boolean;
    canArchive: boolean;
    canUnarchive: boolean;
    canTrash: boolean;
    canRestore: boolean;
    canPermanentlyDelete: boolean;
}

export interface IWorkspaceFolderResponse {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    position: number;
    isDefault: boolean;
    status: WorkspaceFolderStatus;
    summary?: IWorkspaceFolderSummary;
    allowedActions: IWorkspaceFolderAllowedActions;
    createdBy?: string | null;
    updatedBy?: string | null;
    deletedAt?: Date | null;
    deletedBy?: string | null;
    purgeAfter?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceFolderPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IWorkspaceFolderPaginatedResult {
    data: IWorkspaceFolderResponse[];
    pagination: IWorkspaceFolderPagination;
}
