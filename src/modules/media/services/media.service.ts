import path from "node:path";
import crypto from "node:crypto";
import { Types } from "mongoose";

import { workspaceAvailabilityService } from "../../workspace/services/workspaceAvailability.service.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { MediaRepository } from "../repositories/media.repository.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaStorageProvider,
    MediaType,
    MediaVisibility,
} from "../constants/media.enums.js";
import type {
    IMediaFilter,
    IMediaUpdateRequest,
    IMediaUploadRequest,
} from "../interfaces/media.interface.js";
import { CloudflareR2Service } from "../storage/cloudflareR2.service.js";
import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { permissionAuthorizationService } from "../../permissions/services/permissionAuthorization.service.js";
import { PermissionAction, PermissionModule } from "../../permissions/constants/permission.enums.js";
import { StickyNoteModel } from "../../stickynotes/models/stickynote.model.js";
import { MediaUtil } from "../utils/media.util.js";
import { MediaValidation } from "../validations/media.validation.js";

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
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError("Invalid user ID.", 400);
        }

        const fileName = MediaUtil.sanitizeFileName(data.fileName);
        if (!fileName || fileName.length > MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH) {
            throw new AppError(MediaMessages.INVALID_FILE_NAME, 400);
        }

        const mimeType = (data.mimeType || "").trim().toLowerCase();
        if (!mimeType || mimeType.length > MEDIA_CONSTANTS.MAX_MIME_TYPE_LENGTH) {
            throw new AppError(MediaMessages.INVALID_MIME_TYPE, 400);
        }

        if (!MediaValidation.isValidMediaType(data.mediaType)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_TYPE, 400);
        }

        if (!MediaValidation.isValidPurpose(data.purpose)) {
            throw new AppError(MediaMessages.INVALID_PURPOSE, 400);
        }

        if (!MediaUtil.isMediaTypeAllowedForPurpose(data.purpose, data.mediaType)) {
            throw new AppError(MediaMessages.PURPOSE_MEDIA_TYPE_MISMATCH, 400);
        }

        const sizeValidation = MediaUtil.validateFileSize(data.size, data.mediaType, data.purpose);
        if (!sizeValidation.valid) {
            throw new AppError(sizeValidation.message ?? MediaMessages.INVALID_FILE_SIZE, 400);
        }

        const allowedMimeTypes: readonly string[] = MEDIA_CONSTANTS.ALLOWED_MIME_TYPES[data.mediaType];
        if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
            throw new AppError(MediaMessages.MEDIA_TYPE_MISMATCH, 400);
        }

        const rawExtension = MediaUtil.extractExtension(fileName);
        if (rawExtension && !MediaUtil.isExtensionAllowedForMimeType(mimeType, rawExtension)) {
            throw new AppError(MediaMessages.INVALID_FILE_EXTENSION_FOR_MIME, 400);
        }

        const extension = MediaUtil.resolveExtension(fileName, mimeType, data.purpose);

        const hasResourceType = Boolean(data.resourceType);
        const hasResourceId = Boolean(data.resourceId);
        if (hasResourceId && !hasResourceType) {
            throw new AppError(MediaMessages.INVALID_RESOURCE_TYPE, 400);
        }
        if (hasResourceType !== hasResourceId) {
            throw new AppError(MediaMessages.INVALID_RESOURCE, 400);
        }

        await this.assertResourceAvailable(data.resourceType, data.resourceId);
        await this.assertUploadAccess(userId, data.resourceType, data.resourceId);

        const mediaId = new Types.ObjectId();
        const storageKey = this.generateStorageKey({
            userId,
            purpose: data.purpose,
            mediaId,
            resourceType: data.resourceType,
            extension,
        });

        const uploadExpiresAt = new Date(
            Date.now() + MEDIA_CONSTANTS.PENDING_UPLOAD_EXPIRY_MINUTES * 60 * 1000,
        );

        const visibility = data.visibility ?? MEDIA_CONSTANTS.DEFAULT_VISIBILITY;
        const publicUrl =
            visibility === MediaVisibility.PUBLIC ? this.storageService.getPublicUrl(storageKey) : null;

        const resourceId = data.resourceId ? this.validateResourceId(data.resourceId) : null;

        const reservation = await this.subscriptionEntitlementService.assertCanUploadAttachment(
            userId,
            data.resourceType ?? null,
            resourceId,
            data.size,
        );

        try {
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

            const uploadUrl = await this.storageService.createUploadUrl(storageKey, mimeType, data.size);
            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);

            return {
                mediaId: media._id,
                uploadUrl,
                storageKey,
                expiresAt: uploadExpiresAt,
                media,
            };
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId).catch(() => undefined);
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

        // Idempotent completion check: if already active, return the existing active record
        if (media.status === MediaStatus.ACTIVE) {
            return media;
        }

        if (media.status === MediaStatus.FAILED) {
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        if (media.status !== MediaStatus.PENDING) {
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        // Expired upload handling
        if (!media.uploadExpiresAt || media.uploadExpiresAt <= new Date()) {
            await this.storageService.deleteObject(media.storageKey).catch(() => undefined);
            await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.FAILED, {
                uploadExpiresAt: null,
            });
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        // Check object existence in Cloudflare R2
        const metadata = await this.storageService.headObject(media.storageKey).catch(async () => {
            await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.FAILED, {
                uploadExpiresAt: null,
            });
            throw new AppError(MediaMessages.STORAGE_OBJECT_NOT_FOUND, 404);
        });

        const actualSize = metadata.ContentLength ?? 0;
        const actualMimeType = metadata.ContentType?.toLowerCase();

        // Validate uploaded object size matches expectation
        if (actualSize !== media.size) {
            await this.storageService.deleteObject(media.storageKey).catch(() => undefined);
            await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.FAILED, {
                uploadExpiresAt: null,
            });
            throw new AppError(MediaMessages.STORAGE_METADATA_MISMATCH, 400);
        }

        // Validate uploaded object MIME type matches expectation
        if (actualMimeType && actualMimeType !== media.mimeType) {
            await this.storageService.deleteObject(media.storageKey).catch(() => undefined);
            await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.FAILED, {
                uploadExpiresAt: null,
            });
            throw new AppError(MediaMessages.STORAGE_METADATA_MISMATCH, 400);
        }

        // Atomic transition from PENDING to ACTIVE
        const updated = await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.ACTIVE, {
            uploadExpiresAt: null,
        });

        if (!updated) {
            // Concurrent request might have completed it just now
            const current = await this.mediaRepository.findByIdForUser(mediaId, userId);
            if (current && current.status === MediaStatus.ACTIVE) {
                return current;
            }
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }

        return updated;
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

        const mediaObj = typeof (media as any).toObject === "function" ? (media as any).toObject() : { ...media };

        // Secure download URL generation for private media
        if (media.visibility === MediaVisibility.PRIVATE) {
            if (media.status === MediaStatus.ACTIVE) {
                mediaObj.downloadUrl = await this.storageService.createDownloadUrl(media.storageKey);
            } else {
                mediaObj.downloadUrl = null;
            }
            mediaObj.publicUrl = null;
        } else if (media.visibility === MediaVisibility.PUBLIC) {
            mediaObj.publicUrl = this.storageService.getPublicUrl(media.storageKey);
            mediaObj.downloadUrl = mediaObj.publicUrl;
        }

        return mediaObj;
    }

    async getDownloadUrl(mediaId: string, userId: string) {
        if (!Types.ObjectId.isValid(mediaId)) {
            throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        }

        const media = await this.mediaRepository.findByIdForUser(mediaId, userId);
        if (!media) {
            throw new AppError(MediaMessages.NOT_FOUND, 404);
        }

        await this.assertResourceAvailable(media.resourceType, media.resourceId);

        if (media.status !== MediaStatus.ACTIVE) {
            throw new AppError(MediaMessages.CANNOT_DOWNLOAD_UNPROCESSED_MEDIA, 400);
        }

        if (media.visibility === MediaVisibility.PUBLIC) {
            return {
                downloadUrl: this.storageService.getPublicUrl(media.storageKey),
                visibility: MediaVisibility.PUBLIC,
            };
        }

        const downloadUrl = await this.storageService.createDownloadUrl(media.storageKey);
        return {
            downloadUrl,
            visibility: MediaVisibility.PRIVATE,
            expiresInSeconds: MEDIA_CONSTANTS.DOWNLOAD_URL_EXPIRES_IN_SECONDS,
        };
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
            const cleanName = MediaUtil.sanitizeFileName(data.originalFileName);
            if (!cleanName || cleanName.length > MEDIA_CONSTANTS.MAX_FILE_NAME_LENGTH) {
                throw new AppError(MediaMessages.INVALID_FILE_NAME, 400);
            }
            updateData.originalFileName = cleanName;
        }

        if (data.extension !== undefined) {
            updateData.extension = data.extension ? data.extension.trim().toLowerCase() : null;
        }

        if (data.purpose !== undefined) {
            if (!MediaValidation.isValidPurpose(data.purpose)) {
                throw new AppError(MediaMessages.INVALID_PURPOSE, 400);
            }
            if (!MediaUtil.isMediaTypeAllowedForPurpose(data.purpose, media.mediaType)) {
                throw new AppError(MediaMessages.PURPOSE_MEDIA_TYPE_MISMATCH, 400);
            }
            updateData.purpose = data.purpose;
        }

        if (data.visibility !== undefined) {
            if (!MediaValidation.isValidVisibility(data.visibility)) {
                throw new AppError(MediaMessages.INVALID_VISIBILITY, 400);
            }
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

        const nextType = data.resourceType !== undefined ? data.resourceType : media.resourceType;
        const nextId = data.resourceId !== undefined ? data.resourceId : media.resourceId;
        await this.assertResourceAvailable(nextType, nextId);

        const associationChanged =
            nextType !== media.resourceType || String(nextId ?? "") !== String(media.resourceId ?? "");
        if (!associationChanged) {
            return this.mediaRepository.updateById(mediaId, updateData as any);
        }

        await this.assertUploadAccess(userId, nextType, nextId);
        if (media.status !== MediaStatus.ACTIVE) {
            throw new AppError("Complete the upload before moving its attachment.", 409);
        }

        const previousScope = await this.subscriptionEntitlementService.resolveAttachmentBillingScope(
            userId,
            media.resourceType ?? null,
            media.resourceId ?? null,
        );
        const destinationScope = await this.subscriptionEntitlementService.resolveAttachmentBillingScope(
            userId,
            nextType ?? null,
            nextId ?? null,
        );

        if (previousScope.id === destinationScope.id) {
            await this.subscriptionEntitlementService.assertFeatureEnabled(
                destinationScope,
                FeatureCode.ATTACHMENTS,
            );
            return this.mediaRepository.updateById(mediaId, updateData as any);
        }

        // Moving a file can change the billing owner. Reserve against the destination
        // before changing its association, just as for a new upload.
        const reservation = await this.subscriptionEntitlementService.assertCanUploadAttachment(
            userId,
            nextType ?? null,
            nextId ?? null,
            media.size,
        );
        try {
            const updated = await this.mediaRepository.updateById(mediaId, updateData as any);
            if (!updated) throw new AppError(MediaMessages.NOT_FOUND, 404);
            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return updated;
        } catch (error) {
            await this.subscriptionEntitlementService.releaseReservation(reservation.reservationId);
            throw error;
        }
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

        // Soft-delete the media record in DB first with storageDeletionPending flag
        const marked = await this.mediaRepository.markDeleted(mediaId);

        // Check if underlying storageKey is referenced by another active media record
        const isReferencedElsewhere = await this.mediaRepository.isStorageKeyReferencedElsewhere(
            media.storageKey,
            mediaId,
        );

        if (!isReferencedElsewhere) {
            try {
                // Ensure configured bucket matches
                if (media.bucket === this.storageService.getBucketName()) {
                    await this.storageService.deleteObject(media.storageKey);
                }
                // When R2 deletion succeeds, purge tombstone
                await this.mediaRepository.deleteStorageTombstone(mediaId);
            } catch (storageError) {
                // When R2 deletion fails, tombstone remains with storageDeletionPending: true for scheduled retry
                console.warn(
                    `[MediaService] Storage deletion for ${media.storageKey} failed. Tombstone scheduled for retry:`,
                    storageError,
                );
            }
        } else {
            // Shared reference exists; remove only this tombstone without deleting the R2 object
            await this.mediaRepository.deleteStorageTombstone(mediaId);
        }

        return marked;
    }

    async cleanupPendingUploads(batchLimit = MEDIA_CONSTANTS.CLEANUP_BATCH_SIZE): Promise<number> {
        const expiredMedia = await this.mediaRepository.findExpiredPendingUploads(batchLimit);
        let cleaned = 0;

        for (const media of expiredMedia) {
            try {
                // Atomically claim by transitioning status from PENDING to FAILED
                const claimed = await this.mediaRepository.updateStatusFromPending(
                    media._id.toString(),
                    MediaStatus.FAILED,
                    { uploadExpiresAt: null },
                );

                if (!claimed) {
                    continue; // claimed by another worker
                }

                // Delete file from R2 if not referenced elsewhere
                const isReferenced = await this.mediaRepository.isStorageKeyReferencedElsewhere(
                    media.storageKey,
                    media._id.toString(),
                );

                if (!isReferenced) {
                    await this.storageService.deleteObject(media.storageKey).catch(() => undefined);
                }

                await this.mediaRepository.deleteDocument(media._id.toString());
                cleaned += 1;
            } catch (err) {
                console.error(`[MediaService] Failed to clean expired pending media ${media._id}:`, err);
            }
        }

        return cleaned;
    }

    async cleanupPendingStorageDeletions(
        batchLimit = MEDIA_CONSTANTS.CLEANUP_BATCH_SIZE,
    ): Promise<{ deleted: number; failed: number }> {
        const media = await this.mediaRepository.findPendingStorageDeletions(batchLimit);
        const result = { deleted: 0, failed: 0 };

        for (const file of media) {
            try {
                const isReferenced = await this.mediaRepository.isStorageKeyReferencedElsewhere(
                    file.storageKey,
                    file._id.toString(),
                );

                if (!isReferenced && file.bucket === this.storageService.getBucketName()) {
                    await this.storageService.deleteObject(file.storageKey);
                }

                await this.mediaRepository.deleteStorageTombstone(file._id.toString());
                result.deleted += 1;
            } catch (err) {
                result.failed += 1;
                console.warn(`[MediaService] Retry storage deletion failed for ${file.storageKey}:`, err);
            }
        }

        return result;
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

    private async assertUploadAccess(
        userId: string,
        type: MediaResourceType | null | undefined,
        id: unknown,
    ) {
        if (type === MediaResourceType.NOTE || type === MediaResourceType.WORKSPACE) {
            if (!id || !Types.ObjectId.isValid(String(id))) {
                throw new AppError(MediaMessages.INVALID_RESOURCE_ID, 400);
            }
            if (type === MediaResourceType.NOTE) {
                const note = await StickyNoteModel.findById(String(id)).lean().exec();
                if (!note) throw new AppError("Note not found.", 404);
                const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                    userId,
                    String(note.workspaceId),
                );
                permissionAuthorizationService.assertNoteAccess(auth, note, PermissionAction.UPDATE);
            } else {
                const auth = await permissionAuthorizationService.resolveWorkspaceAuthorization(
                    userId,
                    String(id),
                );
                permissionAuthorizationService.assertPermission(
                    auth,
                    PermissionModule.WORKSPACE,
                    PermissionAction.UPDATE,
                );
            }
        } else if (id && (type !== MediaResourceType.USER || String(id) !== userId)) {
            throw new AppError(MediaMessages.INVALID_RESOURCE_ID, 400);
        }
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
            case MediaPurpose.PROFILE_IMAGE:
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

    generateStorageKey(params: {
        userId: string;
        purpose: MediaPurpose;
        mediaId: Types.ObjectId;
        resourceType?: MediaResourceType | null;
        extension?: string | null;
    }): string {
        const year = new Date().getFullYear();
        const ext = params.extension ? `.${params.extension}` : "";

        if (params.purpose === MediaPurpose.PROFILE_IMAGE || params.purpose === MediaPurpose.AVATAR) {
            const uniqueFileName = crypto.randomUUID();
            return `user/avatars/${params.userId}/${year}/${uniqueFileName}${ext}`;
        }

        const resourceFolder = this.getResourceFolder(params.resourceType);
        const purposeFolder = this.getPurposeFolder(params.purpose);
        const randomKey = crypto.randomBytes(16).toString("hex");

        return `${resourceFolder}/${purposeFolder}/${year}/${params.mediaId.toString()}-${randomKey}${ext}`;
    }
}
