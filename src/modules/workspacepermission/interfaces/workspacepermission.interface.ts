import { Document, Types } from "mongoose";

export interface IWorkspacePermission {
    key: string;               
    name: string;              
    description?: string;      
    isActive: boolean;         

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IWorkspacePermissionDocument extends IWorkspacePermission, Document { }