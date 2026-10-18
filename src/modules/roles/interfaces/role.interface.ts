import {
    Document,
    Types,
} from "mongoose";

import {
    RoleType,
    RoleScope,
} from "../constants/role.enums.js";

export interface IRole {
    name: string;

    displayName: string;

    code: string;

    description?: string;

    type: RoleType;

    scope: RoleScope;

    workspaceId?: Types.ObjectId | null;

    permissions: Types.ObjectId[];

    isSystem: boolean;

    isDefault: boolean;

    priority: number;

    isActive: boolean;

    createdBy?: Types.ObjectId | null;

    updatedBy?: Types.ObjectId | null;

    createdAt?: Date;

    updatedAt?: Date;
}

export interface IRoleCreateInput {
    name: string;

    displayName: string;

    code: string;

    description?: string;

    scope?: RoleScope;

    workspaceId?: string | Types.ObjectId | null;

    permissions?: Array<string | Types.ObjectId>;
    priority?: number;
    isActive?: boolean;
}

export interface IRoleUpdateInput {
    name?: string;

    displayName?: string;

    code?: string;

    description?: string;

    permissions?: Array<string | Types.ObjectId>;

    isActive?: boolean;
}

export interface IRoleFilter {
    page?: number;

    limit?: number;

    search?: string;

    type?: RoleType;

    scope?: RoleScope;

    workspaceId?: string;

    isActive?: boolean;

    isSystem?: boolean;

    sortBy?: string;

    sortOrder?: "asc" | "desc";
}

export interface IRoleDocument
    extends IRole,
    Document { }

export interface IRoleResponse {
    id: string;
    _id?: string;
    name: string;
    displayName: string;
    code: string;
    description?: string;
    type: RoleType;
    scope: RoleScope;
    workspaceId?: string | null;
    permissions: Array<string | any>;
    isSystem: boolean;
    isDefault: boolean;
    priority: number;
    isActive: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}