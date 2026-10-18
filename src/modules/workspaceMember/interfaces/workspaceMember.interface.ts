import type { Document, Types } from "mongoose";

import type { WorkspaceMemberStatus } from "../constants/workspaceMember.enums.js";

export interface IWorkspaceMember {
    workspaceId: Types.ObjectId;
    userId: Types.ObjectId;
    roleId: Types.ObjectId;
    status: WorkspaceMemberStatus;
    invitedBy?: Types.ObjectId | null;
    joinedAt?: Date | null;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceMemberDocument extends IWorkspaceMember, Document {
    _id: Types.ObjectId;
}

export interface IWorkspaceMemberCreate {
    workspaceId: string;
    userId: string;
    roleId: string;
}

export interface IWorkspaceMemberUpdate {
    roleId: string;
}

export type WorkspaceMemberSortField = "createdAt" | "updatedAt" | "joinedAt" | "status";

export interface IWorkspaceMemberFilter {
    page?: number;
    limit?: number;
    workspaceId?: string;
    userId?: string;
    roleId?: string;
    status?: WorkspaceMemberStatus;
    search?: string;
    sortBy?: WorkspaceMemberSortField;
    sortOrder?: "asc" | "desc";
}

/**
 * Small user-facing shape used by the members list screen.
 * It intentionally does not expose the complete User/UserProfile document.
 */
export interface IWorkspaceMemberListPerson {
    id: string;
    displayName: string;
    email: string;
}

/**
 * Only role fields required by the people table / role selector.
 * Permissions are intentionally excluded from the list response.
 */
export interface IWorkspaceMemberListRole {
    id: string;
    code: string;
    name: string;
}

/**
 * Lightweight response for GET /workspacemembers/getall.
 *
 * The endpoint is already scoped by workspaceId, therefore returning the
 * complete workspace object on every row would only duplicate data.
 */
export interface IWorkspaceMemberListItem {
    id: string;

    user: IWorkspaceMemberListPerson;
    role: IWorkspaceMemberListRole;

    status: WorkspaceMemberStatus;

    joinedAt: Date | null;
    lastActiveAt: Date | null;

    addedBy: IWorkspaceMemberListPerson | null;

    isOwner: boolean;
    isCurrentUser: boolean;
}

export interface IWorkspaceMemberListResult {
    data: IWorkspaceMemberListItem[];
    pagination: IWorkspaceMemberPagination;
}

export interface IWorkspaceMemberPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
