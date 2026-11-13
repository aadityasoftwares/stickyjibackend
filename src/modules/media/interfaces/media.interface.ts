import type { Document, Types } from "mongoose";

import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaStorageProvider,
    MediaType,
    MediaVisibility,
} from "../constants/media.enums.js";

export interface IMedia {
    tenantId?: Types.ObjectId | null;
    workspaceId?: Types.ObjectId | null;
    storageKeyVersion?: number;
    checksum?: string | null;
    uploadedAt?: Date | null;
    uploadUrlExpiresAt?: Date | null;
    lastVerifiedAt?: Date | null;
    sortOrder?: number;
    uploadOperationId?: string;
    _id?: Types.ObjectId;
    uploadedBy: Types.ObjectId;
    storageProvider: MediaStorageProvider;
    bucket: string;
    storageKey: string;
    publicUrl?: string | null;
    downloadUrl?: string | null;
    originalFileName: string;
    mimeType: string;
    extension?: string | null;
    size: number;
    mediaType: MediaType;
    purpose: MediaPurpose;
    visibility: MediaVisibility;
    status: MediaStatus;
    resourceType?: MediaResourceType | null;
    resourceId?: Types.ObjectId | null;
    uploadExpiresAt?: Date | null;
    deletedAt?: Date | null;
    storageDeletionPending?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IMediaDocument extends IMedia, Document {
    _id: Types.ObjectId;
}

export interface IMediaUploadRequest {
    idempotencyKey?: string;
    fileName: string;
    mimeType: string;
    size: number;
    mediaType: MediaType;
    purpose: MediaPurpose;
    visibility?: MediaVisibility;
    resourceType?: MediaResourceType | null;
    resourceId?: Types.ObjectId | string | null;
}

export interface IMediaUpdateRequest {
    originalFileName?: string;
    extension?: string | null;
    purpose?: MediaPurpose;
    visibility?: MediaVisibility;
    resourceType?: MediaResourceType | null;
    resourceId?: Types.ObjectId | string | null;
    publicUrl?: string | null;
}

export interface IMediaFilter {
    tenantId?: Types.ObjectId | string;
    workspaceId?: Types.ObjectId | string;
    uploadedBy?: Types.ObjectId | string;
    mediaType?: MediaType;
    purpose?: MediaPurpose;
    visibility?: MediaVisibility;
    status?: MediaStatus;
    resourceType?: MediaResourceType;
    resourceId?: Types.ObjectId | string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}
