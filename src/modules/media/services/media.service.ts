import path from "node:path";
import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { MediaResourceType } from "../constants/media.enums.js";
import crypto from "node:crypto";
import { Types } from "mongoose";

import { AppError } from "../../../utils/errors/app.error.js";

import { MediaRepository } from "../repositories/media.repository.js";

import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";

import {
    MediaPurpose,
    MediaStatus,
    MediaStorageProvider,
    MediaVisibility,
} from "../constants/media.enums.js";

import type {
    IMediaFilter,
    IMediaUpdateRequest,
    IMediaUploadRequest,
} from "../interfaces/media.interface.js";

import { CloudflareR2Service } from "../storage/cloudflareR2.service.js";
import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";

export class MediaService {
    private readonly mediaRepository: MediaRepository;
    private readonly storageService: CloudflareR2Service;
    private readonly subscriptionEntitlementService: SubscriptionEntitlementService;

    constructor() {
        this.mediaRepository = new MediaRepository();
        this.storageService = new CloudflareR2Service();
        this.subscriptionEntitlementService = new SubscriptionEntitlementService();
    }

    async requestUpload(data: IMediaUploadRequest, userId: string) {
        await this.assertResourceAvailable(data.resourceType, data.resourceId);
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid user ID.", 400);
        }

        const reservation = await this.subscriptionEntitlementService.assertCanUploadAttachment(
            userId,
            data.resourceType ?? null,
            data.resourceId ? String(data.resourceId) : null,
            data.size,
        );

        const fileName = data.fileName.trim();

        const mimeType = data.mimeType.trim().toLowerCase();

        const extension = path.extname(fileName).toLowerCase().replace(".", "") || null;

        const mediaId = new Types.ObjectId();

        const randomKey = crypto.randomBytes(16).toString("hex");

        const resourceFolder = this.getResourceFolder(data.resourceType);

        const purposeFolder = this.getPurposeFolder(data.purpose);

        const year = new Date().getFullYear();

        const storageKey =
            `${resourceFolder}/${purposeFolder}/${year}/` +
            `${mediaId.toString()}-${randomKey}` +
            `${extension ? `.${extension}` : ""}`;

        const uploadExpiresAt = new Date(
            Date.now() + MEDIA_CONSTANTS.PENDING_UPLOAD_EXPIRY_MINUTES * 60 * 1000,
        );

        const visibility = data.visibility ?? MEDIA_CONSTANTS.DEFAULT_VISIBILITY;

        const publicUrl =
            visibility === MediaVisibility.PUBLIC ? this.storageService.getPublicUrl(storageKey) : null;

        const resourceId = data.resourceId ? this.validateResourceId(data.resourceId) : null;

        const media = await this.mediaRepository.create({
            _id: mediaId,
            uploadedBy: new Types.ObjectId(userId),
            storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
            bucket: this.storageService.getBucketName(),
            storageKey,
            publicUrl,
            originalFileName: fileName,
            mimeType,
            extension,
            size: data.size,
            mediaType: data.mediaType,
            purpose: data.purpose,
            visibility,
            status: MediaStatus.PENDING,
            resourceType: data.resourceType ?? null,
            resourceId,
            uploadExpiresAt,
        });

        try {
            const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType);

            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);

            return {
                mediaId: media._id,
                uploadUrl,
                storageKey,
                expiresAt: uploadExpiresAt,
                media,
            };
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            await this.mediaRepository.deleteDocument(mediaId.toString()).catch(() => undefined);

            throw error;
        }
    }

    async completeUpload(mediaId: string, userId: string) {
        if (!Types.ObjectId.isValid(mediaId)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        }

        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid user ID.", 400);
        }

        const media = await this.mediaRepository.findByIdForUser(mediaId, userId);

        if (!media) {
            throw new AppError(MediaMessages.NOT_FOUND, 404);
        }
        await this.assertResourceAvailable(media.resourceType, media.resourceId);

        if (media.status === MediaStatus.ACTIVE) {
            return media;
        }

        if (media.status !== MediaStatus.PENDING) {
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        if (media.uploadExpiresAt && media.uploadExpiresAt < new Date()) {
            await this.storageService.deleteObject(media.storageKey).catch(() => undefined);

            await this.mediaRepository.updateById(mediaId, {
                status: MediaStatus.FAILED,
            });

            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        const metadata = await this.storageService.headObject(media.storageKey).catch(async () => {
            await this.mediaRepository.updateById(mediaId, {
                status: MediaStatus.FAILED,
            });

            throw new AppError(MediaMessages.STORAGE_OBJECT_NOT_FOUND, 404);
        });

        const actualSize = metadata.ContentLength ?? 0;

        const actualMimeType = metadata.ContentType?.toLowerCase();

        console.log("actualSize");
        console.log(actualSize);
        console.log("media.size");
        console.log(media.size);

        if (actualSize !== media.size) {
            await this.mediaRepository.updateById(mediaId, {
                status: MediaStatus.FAILED,
            });
            console.log("COE");
            throw new AppError(MediaMessages.STORAGE_METADATA_MISMATCH, 400);
        }

        console.log("actualMimeType");
        console.log(actualMimeType);
        console.log("media.mimeType");
        console.log(media.mimeType);
        if (actualMimeType && actualMimeType !== media.mimeType) {
            await this.mediaRepository.updateById(mediaId, {
                status: MediaStatus.FAILED,
            });

            throw new AppError(MediaMessages.STORAGE_METADATA_MISMATCH, 400);
        }

        return this.mediaRepository.updateById(mediaId, {
            status: MediaStatus.ACTIVE,
            uploadExpiresAt: null,
        });
    }

    async getMedia(mediaId: string, userId: string) {
        if (!Types.ObjectId.isValid(mediaId)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        }

        const media = await this.mediaRepository.findByIdForUser(mediaId, userId);

        if (!media) {
            throw new AppError(MediaMessages.NOT_FOUND, 404);
        }
        await this.assertResourceAvailable(media.resourceType, media.resourceId);

        return media;
    }

    async getMediaFiles(userId: string, filters: IMediaFilter = {}) {
        await this.assertResourceAvailable(filters.resourceType, filters.resourceId);
        return this.mediaRepository.findAll({
            ...filters,
            uploadedBy: userId,
        });
    }

    async updateMedia(mediaId: string, userId: string, data: IMediaUpdateRequest) {
        if (!Types.ObjectId.isValid(mediaId)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        }

        const media = await this.mediaRepository.findByIdForUser(mediaId, userId);

        if (!media) {
            throw new AppError(MediaMessages.NOT_FOUND, 404);
        }
        await this.assertResourceAvailable(media.resourceType, media.resourceId);

        const updateData: IMediaUpdateRequest = {};

        if (data.originalFileName !== undefined) {
            updateData.originalFileName = data.originalFileName.trim();
        }

        if (data.extension !== undefined) {
            updateData.extension = data.extension ? data.extension.trim().toLowerCase() : null;
        }

        if (data.purpose !== undefined) {
            updateData.purpose = data.purpose;
        }

        if (data.visibility !== undefined) {
            updateData.visibility = data.visibility;

            if (data.visibility === MediaVisibility.PUBLIC) {
                updateData.publicUrl = this.storageService.getPublicUrl(media.storageKey);
            } else {
                updateData.publicUrl = null;
            }
        }

        if (data.resourceType !== undefined) {
            updateData.resourceType = data.resourceType;
        }

        if (data.resourceId !== undefined) {
            updateData.resourceId = data.resourceId ? this.validateResourceId(data.resourceId) : null;
        }

        await this.assertResourceAvailable(
            data.resourceType !== undefined ? data.resourceType : media.resourceType,
            data.resourceId !== undefined ? data.resourceId : media.resourceId,
        );
        return this.mediaRepository.updateById(mediaId, updateData as any);
    }

    async deleteMedia(mediaId: string, userId: string) {
        if (!Types.ObjectId.isValid(mediaId)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        }

        const media = await this.mediaRepository.findByIdForUser(mediaId, userId);

        if (!media) {
            throw new AppError(MediaMessages.NOT_FOUND, 404);
        }
        await this.assertResourceAvailable(media.resourceType, media.resourceId);

        await this.storageService.deleteObject(media.storageKey).catch(() => undefined);

        return this.mediaRepository.markDeleted(mediaId);
    }

    async cleanupPendingUploads() {
        const mediaFiles = await this.mediaRepository.findExpiredPendingUploads();

        for (const media of mediaFiles) {
            await this.storageService.deleteObject(media.storageKey).catch(() => undefined);

            await this.mediaRepository.deleteDocument(media._id.toString());
        }

        return mediaFiles.length;
    }

    private validateResourceId(resourceId: Types.ObjectId | string): Types.ObjectId {
        if (resourceId instanceof Types.ObjectId) {
            return resourceId;
        }

        if (!Types.ObjectId.isValid(resourceId)) {
            throw new AppError(MediaMessages.INVALID_RESOURCE_ID, 400);
        }

        return new Types.ObjectId(resourceId);
    }

    private async assertResourceAvailable(type: MediaResourceType | null | undefined, id: unknown) {
        if (!id) return;
        if (type === MediaResourceType.WORKSPACE) await workspaceAvailabilityService.assertAvailable(id);
        if (type === MediaResourceType.NOTE)
            await workspaceAvailabilityService.assertNoteWorkspaceAvailable(String(id));
    }

    private getResourceFolder(resourceType: IMediaUploadRequest["resourceType"]): string {
        if (!resourceType) {
            return "unlinked";
        }

        return resourceType.toLowerCase().replace(/_/g, "-");
    }

    private getPurposeFolder(purpose: MediaPurpose): string {
        switch (purpose) {
            case MediaPurpose.AVATAR:
                return "avatars";

            case MediaPurpose.LOGO:
                return "logos";

            case MediaPurpose.ICON:
                return "icons";

            case MediaPurpose.COVER:
                return "covers";

            case MediaPurpose.THUMBNAIL:
                return "thumbnails";

            case MediaPurpose.ATTACHMENT:
                return "attachments";

            case MediaPurpose.GALLERY:
                return "gallery";

            case MediaPurpose.CONTENT:
                return "content";

            case MediaPurpose.DOCUMENT:
                return "documents";

            case MediaPurpose.OTHER:
            default:
                return "other";
        }
    }
}
