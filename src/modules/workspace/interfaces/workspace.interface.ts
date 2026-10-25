import type { Document, Types } from "mongoose";
import type { WorkspaceStatus, WorkspaceType, WorkspaceVisibility } from "../constants/workspace.enums.js";
import type { IResolvedPermission } from "../../permissions/services/permissionAuthorization.service.js";
import type { IWorkspaceMember } from "../../workspaceMember/interfaces/workspaceMember.interface.js";

export type WorkspaceListRecord = IWorkspace & {
    _id: Types.ObjectId;
    membership?:
        | (Pick<IWorkspaceMember, "roleId" | "status" | "joinedAt"> & {
              _id: Types.ObjectId;
              roleName?: string;
              permissions?: IResolvedPermission[];
          })
        | null;
};

export interface WorkspaceStatusCounts {
    all: number;
    active: number;
    archived: number;
}

export type WorkspaceSortField = "name" | "slug" | "createdAt" | "updatedAt";

export interface IWorkspace {
    name: string;
    slug: string;
    description?: string | null;
    ownerId: Types.ObjectId;
    status: WorkspaceStatus;
    visibility: WorkspaceVisibility;
    isPersonal: boolean;
    createdBy?: Types.ObjectId | null;
    updatedBy?: Types.ObjectId | null;
    deletedAt?: Date | null;
    deletedBy?: Types.ObjectId | null;
    purgeAfter?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceDocument extends IWorkspace, Document {
    _id: Types.ObjectId;
}

export interface IWorkspaceCreate {
    name: string;
    slug?: string;
    description?: string | null;
    visibility?: WorkspaceVisibility;
    isPersonal?: boolean;
}

export interface IWorkspaceUpdate {
    name?: string;
    slug?: string;
    description?: string | null;
    visibility?: WorkspaceVisibility;
}

export interface IWorkspaceFilter {
    search?: string;
    ownerId?: Types.ObjectId | string;
    status?: WorkspaceStatus;
    visibility?: WorkspaceVisibility;
    isPersonal?: boolean;
    page?: number;
    limit?: number;
    sortBy?: WorkspaceSortField;
    sortOrder?: "asc" | "desc";
}

export interface IWorkspaceProfileImage {
    id: string;
    url: string;
}

export interface IWorkspaceResponse {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    ownerId: string;
    status: WorkspaceStatus;
    visibility: WorkspaceVisibility;
    isPersonal: boolean;
    isOwner?: boolean;
    isInvited?: boolean;
    role?: string;
    workspaceType?: WorkspaceType;
    workspaceTypeLabel?: string;
    label?: "PERSONAL" | "INVITED" | "WORKSPACE" | string;
    owner?: {
        id: string;
        displayName: string;
        email: string;
        profileImage?: IWorkspaceProfileImage | null;
        avatarUrl?: string | null;
    } | null;
    ownerProfileImage?: IWorkspaceProfileImage | null;
    ownerAvatarUrl?: string | null;
    summary?: {
        folderCount: number;
        folders: Array<{
            id: string;
            name: string;
        }>;
        memberCount: number;
        members: Array<{
            id: string;
            displayName: string;
            email: string;
            role: string;
            isOwner: boolean;
            profileImage?: IWorkspaceProfileImage | null;
            avatarUrl?: string | null;
        }>;
    };
    createdBy?: string | null;
    updatedBy?: string | null;
    deletedAt?: Date | null;
    deletedBy?: string | null;
    purgeAfter?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspacePagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface IWorkspacePaginatedResult {
    data: IWorkspaceResponse[];
    pagination: IWorkspacePagination;
}

export interface IWorkspaceDropdownFolder {
    id: string;
    name: string;
}

export interface IWorkspaceDropdownItem {
    id: string;
    name: string;
    folders: IWorkspaceDropdownFolder[];
}
