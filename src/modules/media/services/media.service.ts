import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { MediaRepository } from "../repositories/media.repository.js";
import { MEDIA_CONSTANTS } from "../constants/media.constants.js";
import { MediaMessages } from "../constants/media.messages.js";
import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaStorageProvider,
    MediaVisibility,
} from "../constants/media.enums.js";
import type {
    IMedia,
    IMediaFilter,
    IMediaUpdateRequest,
    IMediaUploadRequest,
} from "../interfaces/media.interface.js";
import { CloudflareR2Service } from "../storage/cloudflareR2.service.js";
import { R2_CONFIG } from "../../../config/cloudflareR2.config.js";
import { StorageKeyBuilder, type MediaStorageScope } from "../storage/storageKey.builder.js";
import { SubscriptionEntitlementService } from "../../subscriptionentitlement/services/subscriptionentitlement.service.js";
import { SubscriptionEntitlementRepository } from "../../subscriptionentitlement/repositories/subscriptionentitlement.repository.js";
import { PermissionAction } from "../../permissions/constants/permission.enums.js";
import { MediaUtil } from "../utils/media.util.js";
import { MediaValidation } from "../validations/media.validation.js";
import { MediaAccessService } from "./mediaAccess.service.js";
import { MediaContentService } from "./mediaContent.service.js";
import { MediaSecurity } from "../constants/mediaSecurity.constants.js";
import { buildMediaUrl } from "../utils/mediaUrl.util.js";
import { SubscriptionUsageService } from "../../subscriptionusage/services/subscriptionusage.service.js";
import { BillingScopeType } from "../../subscriptionusage/constants/subscriptionusage.enums.js";

export class MediaService {
    private readonly mediaRepository = new MediaRepository();
    private readonly storageService = new CloudflareR2Service();
    private readonly subscriptionEntitlementService = new SubscriptionEntitlementService();
    private readonly locks = new SubscriptionEntitlementRepository();
    private readonly access = new MediaAccessService();
    private readonly content = new MediaContentService();

    async requestUpload(data: IMediaUploadRequest, userId: string) {
        if (Boolean(data.resourceType) !== Boolean(data.resourceId))
            throw new AppError(
                data.resourceId ? MediaMessages.INVALID_RESOURCE_TYPE : MediaMessages.INVALID_RESOURCE,
                400,
            );
        const scope = await this.access.resolve(
            userId,
            data.resourceType,
            data.resourceId,
            PermissionAction.UPDATE,
        );
        const operationId = data.idempotencyKey ? this.operationId(data, userId) : undefined;
        if (scope.noteId || operationId) {
            return this.locks.withQuotaLock(`media:${scope.noteId ?? operationId}`, async (assertLease) => {
                await assertLease();
                return this.initializeUpload(data, userId, scope, operationId, assertLease);
            });
        }
        return this.initializeUpload(data, userId, scope);
    }

    private operationId(data: IMediaUploadRequest, userId: string) {
        if (!data.idempotencyKey || !/^[\w-]{8,100}$/.test(data.idempotencyKey))
            throw new AppError("Invalid idempotency key.", 400);
        return createHash("sha256")
            .update(`${userId}:${data.resourceType ?? ""}:${data.resourceId ?? ""}:${data.idempotencyKey}`)
            .digest("hex");
    }

    private async initializeUpload(
        data: IMediaUploadRequest,
        userId: string,
        scope: MediaStorageScope,
        operationId?: string,
        assertLease?: () => Promise<void>,
    ) {
        const fileName = MediaUtil.sanitizeFileName(data.fileName);
        if (!fileName) throw new AppError(MediaMessages.INVALID_FILE_NAME, 400);
        const mimeType = (data.mimeType || "").trim().toLowerCase();
        if (!MediaValidation.isValidMediaType(data.mediaType))
            throw new AppError(MediaMessages.INVALID_MEDIA_TYPE, 400);
        if (!MediaValidation.isValidPurpose(data.purpose))
            throw new AppError(MediaMessages.INVALID_PURPOSE, 400);
        if (!MediaUtil.isMediaTypeAllowedForPurpose(data.purpose, data.mediaType))
            throw new AppError(MediaMessages.PURPOSE_MEDIA_TYPE_MISMATCH, 400);
        const size = MediaUtil.validateFileSize(data.size, data.mediaType, data.purpose);
        if (!size.valid) throw new AppError(size.message ?? MediaMessages.INVALID_FILE_SIZE, 400);
        const format = MediaSecurity.format(mimeType);
        if (format.mediaType !== data.mediaType) throw new AppError(MediaMessages.MEDIA_TYPE_MISMATCH, 400);
        if (data.size > MediaSecurity.maxFileBytes()) throw new AppError(MediaMessages.FILE_TOO_LARGE, 400);
        const extension = MediaUtil.extractExtension(fileName);
        if (extension && !MediaUtil.isExtensionAllowedForMimeType(mimeType, extension))
            throw new AppError(MediaMessages.INVALID_FILE_EXTENSION_FOR_MIME, 400);
        if (scope.noteId && data.purpose !== MediaPurpose.ATTACHMENT)
            throw new AppError("Note media must use the ATTACHMENT purpose.", 400);
        if (data.visibility && !MediaValidation.isValidVisibility(data.visibility))
            throw new AppError(MediaMessages.INVALID_VISIBILITY, 400);
        const visibility =
            scope.workspaceId || !this.storageService.isPublicBucket(this.storageService.getBucketName())
                ? MediaVisibility.PRIVATE
                : (data.visibility ?? MediaVisibility.PRIVATE);
        if (visibility === MediaVisibility.PUBLIC && !mimeType.startsWith("image/"))
            throw new AppError("Documents must remain private.", 400);
        const bucket = this.storageService.getUploadBucket(visibility === MediaVisibility.PRIVATE);
        if (operationId) {
            const previous = await this.mediaRepository.findByOperationId(operationId);
            if (previous) {
                await this.access.assertMedia(previous, userId, PermissionAction.UPDATE);
                if (
                    previous.originalFileName !== fileName ||
                    previous.mimeType !== mimeType ||
                    previous.size !== data.size ||
                    previous.purpose !== data.purpose ||
                    previous.visibility !== visibility
                ) {
                    throw new AppError("Idempotency key was already used for different file metadata.", 409);
                }
                return this.uploadResponse(previous);
            }
        }
        if (scope.noteId)
            await this.subscriptionEntitlementService.assertNoteAttachmentCapacity(
                scope.accountId,
                scope.noteId,
            );
        const reservation = await this.subscriptionEntitlementService.assertCanUploadAttachment(
            userId,
            data.resourceType ?? null,
            data.resourceId ?? null,
            data.size,
        );
        const mediaId = new Types.ObjectId();
        try {
            await assertLease?.();
            const currentScope = await this.access.resolve(
                userId,
                data.resourceType,
                data.resourceId,
                PermissionAction.UPDATE,
            );
            if (JSON.stringify(currentScope) !== JSON.stringify(scope))
                throw new AppError("Storage ownership changed.", 409);
            const media = await this.mediaRepository.create({
                _id: mediaId,
                uploadedBy: new Types.ObjectId(userId),
                tenantId: scope.tenantId ? new Types.ObjectId(scope.tenantId) : null,
                workspaceId: scope.workspaceId ? new Types.ObjectId(scope.workspaceId) : null,
                storageProvider: MediaStorageProvider.CLOUDFLARE_R2,
                bucket,
                storageKey: StorageKeyBuilder.build(scope, data.purpose, format.extension),
                storageKeyVersion: StorageKeyBuilder.VERSION,
                publicUrl: null,
                originalFileName: fileName,
                mimeType,
                extension: format.extension,
                size: data.size,
                mediaType: data.mediaType,
                purpose: data.purpose,
                visibility,
                status: MediaStatus.PENDING,
                resourceType: data.resourceType ?? null,
                resourceId: data.resourceId ? new Types.ObjectId(String(data.resourceId)) : null,
                uploadExpiresAt: new Date(Date.now() + MEDIA_CONSTANTS.PENDING_UPLOAD_EXPIRY_MINUTES * 60000),
                uploadUrlExpiresAt: new Date(
                    Date.now() + MEDIA_CONSTANTS.UPLOAD_URL_EXPIRES_IN_SECONDS * 1000,
                ),
                ...(operationId ? { uploadOperationId: operationId } : {}),
            });
            const result = await this.uploadResponse(media);
            // Handoff the short reservation to durable PENDING Media, included in admission only.
            await this.subscriptionEntitlementService.commitReservation(reservation.reservationId);
            return result;
        } catch (error) {
            await this.mediaRepository.markDeleted(String(mediaId)).catch(() => undefined);
            await this.subscriptionEntitlementService
                .releaseReservation(reservation.reservationId)
                .catch(() => undefined);
            throw error;
        }
    }

    private async uploadResponse(media: IMedia & { _id: Types.ObjectId }) {
        if (media.status === MediaStatus.ACTIVE)
            return {
                mediaId: media._id,
                media,
                storageKey: media.storageKey,
                uploadUrl: null,
                expiresAt: null,
                requiredHeaders: {},
            };
        const seconds = Math.floor(((media.uploadUrlExpiresAt?.getTime() ?? 0) - Date.now()) / 1000);
        if (media.status !== MediaStatus.PENDING || seconds <= 0)
            throw new AppError(
                "This upload URL has expired. Complete an existing upload or start with a new idempotency key.",
                409,
            );
        const uploadUrl = await this.storageService.createUploadUrl(
            media.storageKey,
            media.mimeType,
            media.size,
            media.bucket,
            seconds,
        );
        return {
            mediaId: media._id,
            media,
            storageKey: media.storageKey,
            uploadUrl,
            expiresAt: media.uploadUrlExpiresAt,
            requiredHeaders: { "Content-Type": media.mimeType, "If-None-Match": "*" },
        };
    }

    private async findAuthorized(mediaId: string, userId: string, action = PermissionAction.READ) {
        if (!Types.ObjectId.isValid(mediaId)) throw new AppError(MediaMessages.INVALID_MEDIA_ID, 400);
        const media = await this.mediaRepository.findById(mediaId);
        if (!media || media.storageDeletionPending) throw new AppError(MediaMessages.NOT_FOUND, 404);
        await this.access.assertMedia(media, userId, action);
        this.storageService.assertBucket(media.bucket);
        return media;
    }

    async completeUpload(mediaId: string, userId: string) {
        const media = await this.findAuthorized(mediaId, userId, PermissionAction.UPDATE);
        if (media.status === MediaStatus.ACTIVE) return media;
        if (media.status !== MediaStatus.PENDING) throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        if (!media.uploadExpiresAt || media.uploadExpiresAt <= new Date()) {
            await this.failUpload(mediaId);
            throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 400);
        }
        // Transient HEAD errors leave PENDING so upload/completion can be retried.
        const metadata = await this.storageService.headObject(media.storageKey, media.bucket);
        if (metadata.ContentLength !== media.size || metadata.ContentType?.toLowerCase() !== media.mimeType) {
            await this.failUpload(mediaId);
            throw new AppError(MediaMessages.STORAGE_METADATA_MISMATCH, 400);
        }
        let checksum: string | null = null;
        if (media.storageKeyVersion === 2) {
            try {
                checksum = await this.content.verify(this.storageService, media);
            } catch (error) {
                await this.failUpload(mediaId);
                throw error;
            }
        }
        await this.access.assertMedia(media, userId, PermissionAction.UPDATE);
        const now = new Date();
        const resolvedPublicUrl = buildMediaUrl(media.storageKey);
        const updated = await this.mediaRepository.updateStatusFromPending(mediaId, MediaStatus.ACTIVE, {
            uploadExpiresAt: null,
            uploadedAt: now,
            lastVerifiedAt: now,
            checksum,
            publicUrl:
                media.visibility === MediaVisibility.PUBLIC &&
                this.storageService.isPublicBucket(media.bucket)
                    ? (resolvedPublicUrl ?? this.storageService.getPublicUrl(media.storageKey))
                    : null,
        });
        if (updated) {
            await this.refreshUsage(updated);
            return updated;
        }
        const current = await this.findAuthorized(mediaId, userId, PermissionAction.UPDATE);
        if (current.status === MediaStatus.ACTIVE) return current;
        throw new AppError(MediaMessages.UPLOAD_NOT_COMPLETED, 409);
    }

    private async failUpload(id: string) {
        await this.mediaRepository.updateStatusFromPending(id, MediaStatus.FAILED, {
            storageDeletionPending: true,
            deletedAt: new Date(),
            publicUrl: null,
        });
    }

    async getMedia(mediaId: string, userId: string) {
        const media = await this.findAuthorized(mediaId, userId);
        const result = media.toObject();
        const url = buildMediaUrl(media.storageKey, media.publicUrl);
        const isPublic =
            media.status === MediaStatus.ACTIVE &&
            this.storageService.isPublicBucket(media.bucket) &&
            !media.workspaceId &&
            media.resourceType !== MediaResourceType.NOTE &&
            media.resourceType !== MediaResourceType.WORKSPACE;

        return {
            ...result,
            publicUrl: isPublic ? (url ?? result.publicUrl ?? null) : null,
            url: url ?? result.publicUrl ?? null,
            downloadUrl:
                media.status === MediaStatus.ACTIVE
                    ? (await this.getDownloadUrl(mediaId, userId)).downloadUrl
                    : null,
        };
    }

    async getDownloadUrl(mediaId: string, userId: string) {
        const media = await this.findAuthorized(mediaId, userId);
        if (media.status !== MediaStatus.ACTIVE)
            throw new AppError(MediaMessages.CANNOT_DOWNLOAD_UNPROCESSED_MEDIA, 400);

        const publicUrl = buildMediaUrl(media.storageKey, media.publicUrl);
        const isSeparatePrivateBucket =
            Boolean(R2_CONFIG.PRIVATE_BUCKET_NAME) &&
            R2_CONFIG.PRIVATE_BUCKET_NAME !== this.storageService.getBucketName() &&
            media.bucket === R2_CONFIG.PRIVATE_BUCKET_NAME;

        if (publicUrl && !isSeparatePrivateBucket) {
            return {
                downloadUrl: publicUrl,
                url: publicUrl,
                publicUrl,
                visibility: media.visibility,
                expiresInSeconds: MEDIA_CONSTANTS.DOWNLOAD_URL_EXPIRES_IN_SECONDS,
            };
        }

        const downloadUrl = await this.storageService.createDownloadUrl(
            media.storageKey,
            MEDIA_CONSTANTS.DOWNLOAD_URL_EXPIRES_IN_SECONDS,
            media.originalFileName,
            media.bucket,
        );
        return {
            downloadUrl,
            url: publicUrl ?? downloadUrl,
            publicUrl: publicUrl ?? downloadUrl,
            visibility: media.visibility,
            expiresInSeconds: MEDIA_CONSTANTS.DOWNLOAD_URL_EXPIRES_IN_SECONDS,
        };
    }

    async getMediaFiles(userId: string, filters: IMediaFilter = {}) {
        const scope = await this.access.resolve(userId, filters.resourceType, filters.resourceId);
        const result = await this.mediaRepository.findAll({
            ...filters,
            tenantId: scope.tenantId,
            workspaceId: scope.workspaceId,
            uploadedBy: scope.workspaceId ? undefined : userId,
            status: MediaStatus.ACTIVE,
            page: Math.max(1, Math.floor(filters.page ?? 1)),
            limit: Math.min(100, Math.max(1, Math.floor(filters.limit ?? 10))),
            sortBy: ["createdAt", "originalFileName", "size", "sortOrder"].includes(filters.sortBy ?? "")
                ? filters.sortBy
                : "createdAt",
        });
        return {
            ...result,
            data: result.data.map((item) => {
                const doc = typeof (item as any).toObject === "function" ? (item as any).toObject() : item;
                const url = buildMediaUrl(doc.storageKey, doc.publicUrl);
                return {
                    ...doc,
                    publicUrl: url ?? doc.publicUrl ?? null,
                    url: url ?? doc.publicUrl ?? null,
                };
            }),
        };
    }

    async updateMedia(mediaId: string, userId: string, data: IMediaUpdateRequest) {
        const media = await this.findAuthorized(mediaId, userId, PermissionAction.UPDATE);
        if (
            (data.resourceType !== undefined && data.resourceType !== media.resourceType) ||
            (data.resourceId !== undefined &&
                String(data.resourceId ?? "") !== String(media.resourceId ?? ""))
        ) {
            throw new AppError("Media reassignment requires an explicit authorized transfer workflow.", 409);
        }
        if (
            (data.purpose !== undefined && data.purpose !== media.purpose) ||
            (data.extension !== undefined && data.extension !== media.extension) ||
            (data.visibility !== undefined && data.visibility !== media.visibility)
        ) {
            throw new AppError(
                "Media purpose, format and visibility cannot be changed after upload initialization.",
                409,
            );
        }
        const update: Partial<IMedia> = {};
        if (data.originalFileName !== undefined) {
            const name = MediaUtil.sanitizeFileName(data.originalFileName);
            if (!name) throw new AppError(MediaMessages.INVALID_FILE_NAME, 400);
            update.originalFileName = name;
        }
        return this.mediaRepository.updateById(mediaId, update);
    }

    async deleteMedia(mediaId: string, userId: string) {
        const media = await this.findAuthorized(mediaId, userId, PermissionAction.UPDATE);
        const marked = await this.mediaRepository.markDeleted(mediaId);
        await this.refreshUsage(media);
        if (this.canDeleteObject(media)) await this.deleteTombstone(media).catch(() => undefined);
        return marked;
    }

    private async refreshUsage(media: IMedia) {
        await new SubscriptionUsageService()
            .recalculateUsage({ type: BillingScopeType.USER, id: String(media.tenantId ?? media.uploadedBy) })
            .catch(() => undefined);
    }

    private canDeleteObject(media: IMedia): boolean {
        const expiry =
            media.uploadUrlExpiresAt ?? (media.status === MediaStatus.PENDING ? media.uploadExpiresAt : null);
        return !expiry || expiry.getTime() + 3600000 < Date.now();
    }

    private async deleteTombstone(media: IMedia & { _id: Types.ObjectId }) {
        this.storageService.assertBucket(media.bucket);
        if (
            !(await this.mediaRepository.isStorageKeyReferencedElsewhere(media.storageKey, String(media._id)))
        ) {
            await this.storageService.deleteObject(media.storageKey, media.bucket);
        }
        await this.mediaRepository.deleteStorageTombstone(String(media._id));
    }

    async cleanupPendingUploads(batchLimit = MEDIA_CONSTANTS.CLEANUP_BATCH_SIZE) {
        const expired = await this.mediaRepository.findExpiredPendingUploads(batchLimit);
        let cleaned = 0;
        for (const media of expired) {
            const claimed = await this.mediaRepository.updateStatusFromPending(
                String(media._id),
                MediaStatus.FAILED,
                { storageDeletionPending: true, deletedAt: new Date(), publicUrl: null },
            );
            if (claimed) cleaned++;
        }
        await this.cleanupPendingStorageDeletions(batchLimit);
        return cleaned;
    }

    async cleanupPendingStorageDeletions(batchLimit = MEDIA_CONSTANTS.CLEANUP_BATCH_SIZE) {
        const files = await this.mediaRepository.findPendingStorageDeletions(batchLimit);
        const result = { deleted: 0, failed: 0 };
        for (const file of files) {
            if (!this.canDeleteObject(file)) continue;
            try {
                await this.deleteTombstone(file);
                result.deleted++;
            } catch {
                result.failed++;
            }
        }
        return result;
    }

    generateStorageKey(params: {
        userId: string;
        purpose: MediaPurpose;
        mediaId: Types.ObjectId;
        resourceType?: MediaResourceType | null;
        extension?: string | null;
        scope?: MediaStorageScope;
    }) {
        if (
            [MediaResourceType.NOTE, MediaResourceType.WORKSPACE].includes(params.resourceType!) &&
            !params.scope?.tenantId
        ) {
            throw new AppError("Resource storage keys require resolved tenant ownership.", 400);
        }
        return StorageKeyBuilder.build(
            params.scope ?? { accountId: params.userId },
            params.purpose,
            params.extension ?? "jpg",
        );
    }
}
