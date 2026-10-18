import type { Document, Types } from "mongoose";

export type NotesWorkspaceVisibility =
    | "private"
    | "team"
    | "public";

export interface INotesWorkspaceDocument extends Document {

    title: string;
    description?: string;
    owner: Types.ObjectId;
    visibility: NotesWorkspaceVisibility;
    backgroundColor?: string;
    backgroundImage?: Types.ObjectId;
    backgroundImageUrl?: string;
    members: Types.ObjectId[];
    isArchived: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface INotesWorkspaceCreatePayload {

    title: string;
    description?: string;
    visibility?: NotesWorkspaceVisibility;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundImageUrl?: string;
    members?: string[];
}

export interface INotesWorkspaceUpdatePayload {

    title?: string;
    description?: string;
    visibility?: NotesWorkspaceVisibility;
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundImageUrl?: string;
    members?: string[];
    isArchived?: boolean;
    isActive?: boolean;
}

export interface INotesWorkspaceFilterPayload {

    search?: string;
    owner?: string;
    visibility?: NotesWorkspaceVisibility;
    isArchived?: boolean;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?:
    | "title"
    | "createdAt"
    | "updatedAt";

    sortOrder?: "asc" | "desc";
}