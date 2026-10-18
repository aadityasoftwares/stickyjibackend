import { Document, Types } from "mongoose";

export interface IWorkspaceRole {

    key: string;
    name: string;
    description?: string;
    permissions: Types.ObjectId[]; 
    isActive: boolean;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspaceRoleDocument extends IWorkspaceRole, Document { }