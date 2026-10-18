import {
    Document,
    Types,
} from "mongoose";

import {
    PermissionAccess,
    PermissionAction,
} from "../constants/permission.enums.js";

export interface IPermission {
    name: string;

    displayName: string;

    code: string;

    module: string;

    action: PermissionAction;

    access: PermissionAccess;

    description?: string;

    sortOrder: number;

    isSystem: boolean;

    isActive: boolean;

    createdBy?: Types.ObjectId | null;

    updatedBy?: Types.ObjectId | null;

    createdAt?: Date;

    updatedAt?: Date;
}

export interface IPermissionCreateInput {
    name: string;

    displayName: string;

    code: string;

    module: string;

    action: PermissionAction;

    access?: PermissionAccess;

    description?: string;

    sortOrder?: number;

    isActive?: boolean;
}

export interface IPermissionUpdateInput {
    name?: string;

    displayName?: string;

    code?: string;

    module?: string;

    action?: PermissionAction;

    access?: PermissionAccess;

    description?: string;

    sortOrder?: number;

    isActive?: boolean;
}

export interface IPermissionFilter {
    page?: number;

    limit?: number;

    search?: string;

    module?: string;

    action?: PermissionAction;

    access?: PermissionAccess;

    isSystem?: boolean;

    isActive?: boolean;

    sortBy?: string;

    sortOrder?: "asc" | "desc";
}

export interface IPermissionDocument
    extends IPermission,
    Document { }

export interface IPermissionResponse {
    id: string;
    _id?: string;
    name: string;
    displayName: string;
    code: string;
    module: string;
    action: PermissionAction;
    access: PermissionAccess;
    description?: string;
    sortOrder: number;
    isSystem: boolean;
    isActive: boolean;
    createdBy?: string | null;
    updatedBy?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}