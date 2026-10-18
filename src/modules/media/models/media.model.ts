import mongoose, { Model, Schema } from "mongoose";
import type { IMediaDocument } from "../interfaces/media.interface.js";
import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaStorageProvider,
    MediaType,
    MediaVisibility,
} from "../constants/media.enums.js";

const MediaSchema = new Schema<IMediaDocument>(
    {
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        storageProvider: {
            type: String,
            enum: Object.values(MediaStorageProvider),
            required: true,
            default: MediaStorageProvider.CLOUDFLARE_R2,
        },
        bucket: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        storageKey: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        publicUrl: {
            type: String,
            trim: true,
            default: null,
        },
        originalFileName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },
        mimeType: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 150,
        },
        extension: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 20,
            default: null,
        },
        size: {
            type: Number,
            required: true,
            min: 1,
        },
        mediaType: {
            type: String,
            enum: Object.values(MediaType),
            required: true,
            index: true,
        },
        purpose: {
            type: String,
            enum: Object.values(MediaPurpose),
            required: true,
            index: true,
        },
        visibility: {
            type: String,
            enum: Object.values(MediaVisibility),
            required: true,
            default: MediaVisibility.PRIVATE,
            index: true,
        },
        status: {
            type: String,
            enum: Object.values(MediaStatus),
            required: true,
            default: MediaStatus.PENDING,
            index: true,
        },
        resourceType: {
            type: String,
            enum: Object.values(MediaResourceType),
            trim: true,
            default: null,
            index: true,
        },
        resourceId: {
            type: Schema.Types.ObjectId,
            default: null,
            index: true,
        },
        uploadExpiresAt: {
            type: Date,
            default: null,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
        storageDeletionPending: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    },
);

MediaSchema.index({
    uploadedBy: 1,
    status: 1,
});

MediaSchema.index({
    purpose: 1,
    status: 1,
});

MediaSchema.index({
    resourceType: 1,
    resourceId: 1,
});

MediaSchema.index({
    resourceType: 1,
    resourceId: 1,
    purpose: 1,
    status: 1,
});

MediaSchema.index({
    status: 1,
    uploadExpiresAt: 1,
});

MediaSchema.index({
    status: 1,
    deletedAt: 1,
});
MediaSchema.index({ storageDeletionPending: 1, deletedAt: 1 });

export const MediaModel: Model<IMediaDocument> = mongoose.model<IMediaDocument>(
    "Media",
    MediaSchema,
);
