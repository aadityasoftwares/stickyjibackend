import { Types } from "mongoose";

import type {
    IUserProfileCreate,
    IUserProfileFilter,
    IUserProfileUpdate,
    IProfileImageSummary,
} from "../interfaces/userProfile.interface.js";
import { UserProfileRepository } from "../repositories/userProfile.repository.js";
import { UserRepository } from "../../user/repositories/user.repository.js";
import { UserProfileMessages } from "../constants/userProfile.messages.js";
import { USER_PROFILE_CONSTANTS } from "../constants/userProfile.constants.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { StringHelper } from "../../../utils/helpers/string.helper.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";

import { MediaService } from "../../media/services/media.service.js";
import { MediaRepository } from "../../media/repositories/media.repository.js";
import { CloudflareR2Service } from "../../media/storage/cloudflareR2.service.js";
import { MediaModel } from "../../media/models/media.model.js";
import {
    MediaPurpose,
    MediaResourceType,
    MediaStatus,
    MediaType,
    MediaVisibility,
} from "../../media/constants/media.enums.js";

/*
 * Public response returned to frontend.
 *
 * Important:
 * - No __v
 * - No mongoose internals
 * - No populated country object
 * - No populated timezone object
 * - No populated language object
 * - No populated currency object
 *
 * Relations are IDs only.
 */
export interface IUserProfileResponse {
    id: string;
    userId: string;

    firstName: string;
    lastName: string;

    displayName: string | null;
    bio: string | null;
    dateOfBirth: Date | null;

    profileType: string;

    occupation: string | null;
    education: string | null;

    interests: string[];

    countryId: string | null;
    timezoneId: string | null;
    languageId: string | null;
    currencyId: string | null;

    profileImage: IProfileImageSummary | null;
    avatarUrl?: string | null;
}

const USER_PROFILE_SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "firstName",
    "lastName",
    "displayName",
    "profileType",
]);

export class UserProfileService {
    private userProfileRepository: UserProfileRepository;
    private userRepository: UserRepository;
    private auditLogService: AuditLogService;
    private mediaService: MediaService;
    private mediaRepository: MediaRepository;
    private storageService: CloudflareR2Service;

    constructor() {
        this.userProfileRepository = new UserProfileRepository();
        this.userRepository = new UserRepository();
        this.auditLogService = new AuditLogService();
        this.mediaService = new MediaService();
        this.mediaRepository = new MediaRepository();
        this.storageService = new CloudflareR2Service();
    }

    async createProfile(data: IUserProfileCreate, context?: IAuditLogContext): Promise<IUserProfileResponse> {
        const userId = data.userId.toString();

        this.validateObjectId(userId, "Invalid user ID.");

        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError(UserProfileMessages.USER_NOT_FOUND, 404);
        }

        const existingProfile = await this.userProfileRepository.existsByUserId(userId);

        if (existingProfile) {
            throw new AppError(UserProfileMessages.ALREADY_EXISTS, 409);
        }

        this.validateRelationIds(data);

        const firstName = StringHelper.normalize(data.firstName);
        const lastName = StringHelper.normalize(data.lastName);

        const profileData: IUserProfileCreate = {
            ...data,
            userId,
            firstName,
            lastName,
            displayName: StringHelper.emptyToNull(data.displayName),
            bio: StringHelper.emptyToNull(data.bio),
            occupation: StringHelper.emptyToNull(data.occupation),
            education: StringHelper.emptyToNull(data.education),
            interests: (data.interests?.map((interest) => StringHelper.normalize(interest)) ?? []).filter(
                Boolean,
            ),
            profileImage: data.profileImage ? new Types.ObjectId(data.profileImage.toString()) : null,
        };

        let profile: Awaited<ReturnType<UserProfileRepository["create"]>>;

        try {
            profile = await this.userProfileRepository.create(profileData);
        } catch (error) {
            if (this.isLegacyUserProfileIndexError(error)) {
                console.error(
                    "Legacy UserProfile index 'user_1' is blocking profile creation. " +
                        "Drop the obsolete index and keep the unique 'userId_1' index.",
                    {
                        userId,
                        error,
                    },
                );

                throw new AppError(
                    "User profile service is temporarily unavailable. Please try again shortly.",
                    503,
                );
            }

            if (this.isDuplicateKeyError(error)) {
                throw new AppError(UserProfileMessages.ALREADY_EXISTS, 409);
            }

            throw error;
        }

        if (!profile) {
            throw new AppError("Unable to create user profile.", 500);
        }

        await this.runAuditSafely(
            "create",
            async () => {
                await this.auditLogService.logCreate(
                    context ?? {},
                    {
                        module: AppModule.USER,
                        resourceId: profile._id.toString(),
                        resourceName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
                    },
                    `User profile for ${user.email} was created successfully.`,
                );
            },
            {
                profileId: profile._id.toString(),
                userId,
            },
        );

        return this.toResponse(profile);
    }

    async getMyProfile(userId: string): Promise<IUserProfileResponse> {
        this.validateObjectId(userId, "Invalid user ID.");

        const profile = await this.userProfileRepository.findByUserId(userId);

        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        return this.toResponse(profile);
    }

    async getProfileById(id: string): Promise<IUserProfileResponse> {
        this.validateObjectId(id, "Invalid user profile ID.");

        const profile = await this.userProfileRepository.findById(id);

        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        return this.toResponse(profile);
    }

    async getProfiles(filters: IUserProfileFilter = {}) {
        this.validateFilterIds(filters);

        if (filters.search) {
            filters.search = StringHelper.normalizeWhitespace(filters.search);
        }

        if (filters.sortBy && !USER_PROFILE_SORT_FIELDS.has(filters.sortBy)) {
            filters.sortBy = "createdAt";
        }

        const result = await this.userProfileRepository.findAll(filters);

        // Preload all profile images in one query to prevent N+1 overhead
        const mediaIds = result.data
            .map((p: any) => p.profileImage)
            .filter((id: any) => id && Types.ObjectId.isValid(String(id)));

        const mediaPreloadMap = new Map<string, any>();
        if (mediaIds.length > 0) {
            const mediaDocs = await MediaModel.find({ _id: { $in: mediaIds } })
                .lean()
                .exec();
            for (const doc of mediaDocs) {
                mediaPreloadMap.set(doc._id.toString(), doc);
            }
        }

        const profiles = await Promise.all(
            result.data.map((profile) => this.toResponse(profile, mediaPreloadMap)),
        );

        return {
            data: profiles,
            pagination: result.pagination,
        };
    }

    async updateMyProfile(
        userId: string,
        data: IUserProfileUpdate,
        context?: IAuditLogContext,
    ): Promise<IUserProfileResponse> {
        this.validateObjectId(userId, "Invalid user ID.");

        if (Object.keys(data).length === 0) {
            throw new AppError(UserProfileMessages.UPDATE_REQUIRED, 400);
        }

        this.validateRelationIds(data);

        const profile = await this.userProfileRepository.findByUserId(userId);
        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        // If profileImage is explicitly specified in update payload
        if (data.profileImage !== undefined) {
            if (data.profileImage === null) {
                return this.removeProfileImage(userId, context);
            }
            return this.setProfileImage(userId, data.profileImage.toString(), context);
        }

        const updateData = this.normalizeUpdateData(data);
        const changes = this.buildAuditChanges(profile, updateData);

        const updatedProfile = await this.userProfileRepository.updateByUserId(userId, updateData);
        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            await this.runAuditSafely(
                "update-my-profile",
                async () => {
                    await this.auditLogService.logUpdate(
                        context ?? {},
                        {
                            module: AppModule.USER,
                            resourceId: profile._id.toString(),
                            resourceName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
                        },
                        "User profile was updated successfully.",
                        changes,
                    );
                },
                {
                    profileId: profile._id.toString(),
                    userId,
                },
            );
        }

        return this.toResponse(updatedProfile);
    }

    async updateProfile(
        id: string,
        data: IUserProfileUpdate,
        context?: IAuditLogContext,
    ): Promise<IUserProfileResponse> {
        this.validateObjectId(id, "Invalid user profile ID.");

        if (Object.keys(data).length === 0) {
            throw new AppError(UserProfileMessages.UPDATE_REQUIRED, 400);
        }

        this.validateRelationIds(data);

        const profile = await this.userProfileRepository.findById(id);
        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        const targetUserId = profile.userId.toString();

        if (data.profileImage !== undefined) {
            if (data.profileImage === null) {
                return this.removeProfileImage(targetUserId, context);
            }
            return this.setProfileImage(targetUserId, data.profileImage.toString(), context);
        }

        const updateData = this.normalizeUpdateData(data);
        const changes = this.buildAuditChanges(profile, updateData);

        const updatedProfile = await this.userProfileRepository.updateByUserId(targetUserId, updateData);
        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            await this.runAuditSafely(
                "update-profile",
                async () => {
                    await this.auditLogService.logUpdate(
                        context ?? {},
                        {
                            module: AppModule.USER,
                            resourceId: profile._id.toString(),
                            resourceName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
                        },
                        "User profile was updated successfully.",
                        changes,
                    );
                },
                {
                    profileId: profile._id.toString(),
                    userId: targetUserId,
                },
            );
        }

        return this.toResponse(updatedProfile);
    }

    /**
     * Initializes presigned upload URL specifically for profile image
     */
    async requestProfileImageUpload(
        userId: string,
        data: { fileName: string; mimeType: string; size: number },
    ) {
        this.validateObjectId(userId, "Invalid user ID.");

        const mime = (data.mimeType || "").trim().toLowerCase();
        if (!USER_PROFILE_CONSTANTS.PROFILE_IMAGE.ALLOWED_MIME_TYPES.includes(mime as any)) {
            throw new AppError(UserProfileMessages.UNSUPPORTED_IMAGE_FORMAT, 400);
        }

        if (
            typeof data.size !== "number" ||
            !Number.isSafeInteger(data.size) ||
            data.size <= 0 ||
            data.size > USER_PROFILE_CONSTANTS.PROFILE_IMAGE.MAX_SIZE
        ) {
            throw new AppError(UserProfileMessages.PROFILE_IMAGE_TOO_LARGE, 400);
        }

        return this.mediaService.requestUpload(
            {
                fileName: data.fileName,
                mimeType: mime,
                size: data.size,
                mediaType: MediaType.IMAGE,
                purpose: MediaPurpose.PROFILE_IMAGE,
                visibility: MediaVisibility.PRIVATE,
                resourceType: MediaResourceType.USER,
                resourceId: userId,
            },
            userId,
        );
    }

    /**
     * Sets or replaces the user profile image with an active, verified Media record
     */
    async setProfileImage(
        userId: string,
        mediaId: string,
        context?: IAuditLogContext,
    ): Promise<IUserProfileResponse> {
        this.validateObjectId(userId, "Invalid user ID.");
        this.validateObjectId(mediaId, UserProfileMessages.INVALID_PROFILE_IMAGE);

        const media = await this.mediaRepository.findById(mediaId, true);
        if (!media) {
            throw new AppError(UserProfileMessages.INVALID_PROFILE_IMAGE, 404);
        }

        // Ownership validation: user cannot attach someone else's media
        if (media.uploadedBy.toString() !== userId) {
            throw new AppError(UserProfileMessages.CANNOT_ATTACH_FOREIGN_MEDIA, 403);
        }

        // Status validation: cannot attach pending, failed, or deleted media
        if (media.status !== MediaStatus.ACTIVE) {
            throw new AppError(UserProfileMessages.MEDIA_NOT_VERIFIED, 400);
        }

        // Purpose validation: must be AVATAR or PROFILE_IMAGE
        if (media.purpose !== MediaPurpose.AVATAR && media.purpose !== MediaPurpose.PROFILE_IMAGE) {
            throw new AppError("Invalid media purpose for profile image.", 400);
        }

        // Media type & format validation: JPEG, PNG, WebP only
        if (media.mediaType !== MediaType.IMAGE) {
            throw new AppError("Invalid media type.", 400);
        }

        const mime = (media.mimeType || "").toLowerCase();
        if (!USER_PROFILE_CONSTANTS.PROFILE_IMAGE.ALLOWED_MIME_TYPES.includes(mime as any)) {
            throw new AppError(UserProfileMessages.UNSUPPORTED_IMAGE_FORMAT, 400);
        }

        if (media.size > USER_PROFILE_CONSTANTS.PROFILE_IMAGE.MAX_SIZE) {
            throw new AppError(UserProfileMessages.PROFILE_IMAGE_TOO_LARGE, 400);
        }

        if (media.resourceType && media.resourceType !== MediaResourceType.USER) {
            throw new AppError("Invalid media resource type for profile image.", 400);
        }

        if (media.resourceId && media.resourceId.toString() !== userId) {
            throw new AppError("Invalid media resource ID for profile image.", 400);
        }

        const profile = await this.userProfileRepository.findByUserId(userId);
        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        const previousMediaId = profile.profileImage ? profile.profileImage.toString() : null;

        // Atomically update profile reference to new media ID
        const updatedProfile = await this.userProfileRepository.updateByUserId(userId, {
            profileImage: media._id,
        });

        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        // Safely clean up previous image if it was replaced and differs
        if (previousMediaId && previousMediaId !== mediaId) {
            await this.mediaService
                .deleteMedia(previousMediaId, userId)
                .catch((err) =>
                    console.warn(
                        `[UserProfileService] Failed to clean up previous profile image ${previousMediaId}:`,
                        err,
                    ),
                );
        }

        await this.runAuditSafely(
            "set-profile-image",
            async () => {
                await this.auditLogService.logUpdate(
                    context ?? {},
                    {
                        module: AppModule.USER,
                        resourceId: profile._id.toString(),
                        resourceName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
                    },
                    "User profile image updated successfully.",
                    [
                        {
                            field: "profileImage",
                            oldValue: previousMediaId,
                            newValue: mediaId,
                        },
                    ],
                );
            },
            {
                profileId: profile._id.toString(),
                userId,
                mediaId,
            },
        );

        return this.toResponse(updatedProfile);
    }

    /**
     * Removes the current profile image and schedules the old image for deletion
     */
    async removeProfileImage(userId: string, context?: IAuditLogContext): Promise<IUserProfileResponse> {
        this.validateObjectId(userId, "Invalid user ID.");

        const profile = await this.userProfileRepository.findByUserId(userId);
        if (!profile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        if (!profile.profileImage) {
            return this.toResponse(profile);
        }

        const oldMediaId = profile.profileImage.toString();

        // Atomically clear profileImage field
        const updatedProfile = await this.userProfileRepository.updateByUserId(userId, {
            profileImage: null,
        });

        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        // Safely schedule old media for deletion
        await this.mediaService
            .deleteMedia(oldMediaId, userId)
            .catch((err) =>
                console.warn(
                    `[UserProfileService] Failed to delete removed profile image ${oldMediaId}:`,
                    err,
                ),
            );

        await this.runAuditSafely(
            "remove-profile-image",
            async () => {
                await this.auditLogService.logUpdate(
                    context ?? {},
                    {
                        module: AppModule.USER,
                        resourceId: profile._id.toString(),
                        resourceName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
                    },
                    "User profile image removed successfully.",
                    [
                        {
                            field: "profileImage",
                            oldValue: oldMediaId,
                            newValue: null,
                        },
                    ],
                );
            },
            {
                profileId: profile._id.toString(),
                userId,
            },
        );

        return this.toResponse(updatedProfile);
    }

    private normalizeUpdateData(data: IUserProfileUpdate): IUserProfileUpdate {
        const updateData: IUserProfileUpdate = {
            ...data,
        };

        if (updateData.firstName !== undefined) {
            updateData.firstName = StringHelper.normalize(updateData.firstName);
        }

        if (updateData.lastName !== undefined) {
            updateData.lastName = StringHelper.normalize(updateData.lastName);
        }

        if (updateData.displayName !== undefined) {
            updateData.displayName = StringHelper.emptyToNull(updateData.displayName);
        }

        if (updateData.bio !== undefined) {
            updateData.bio = StringHelper.emptyToNull(updateData.bio);
        }

        if (updateData.occupation !== undefined) {
            updateData.occupation = StringHelper.emptyToNull(updateData.occupation);
        }

        if (updateData.education !== undefined) {
            updateData.education = StringHelper.emptyToNull(updateData.education);
        }

        if (updateData.interests !== undefined) {
            updateData.interests = updateData.interests
                .map((interest) => StringHelper.normalize(interest))
                .filter(Boolean);
        }

        return updateData;
    }

    private validateRelationIds(data: IUserProfileCreate | IUserProfileUpdate): void {
        this.validateOptionalObjectId(data.countryId, "Invalid country ID.");
        this.validateOptionalObjectId(data.timezoneId, "Invalid timezone ID.");
        this.validateOptionalObjectId(data.languageId, "Invalid language ID.");
        this.validateOptionalObjectId(data.currencyId, "Invalid currency ID.");
        if (data.profileImage !== undefined && data.profileImage !== null) {
            this.validateOptionalObjectId(data.profileImage, UserProfileMessages.INVALID_PROFILE_IMAGE);
        }
    }

    private validateFilterIds(filters: IUserProfileFilter): void {
        this.validateOptionalObjectId(filters.userId, "Invalid user ID.");
        this.validateOptionalObjectId(filters.countryId, "Invalid country ID.");
        this.validateOptionalObjectId(filters.timezoneId, "Invalid timezone ID.");
        this.validateOptionalObjectId(filters.languageId, "Invalid language ID.");
        this.validateOptionalObjectId(filters.currencyId, "Invalid currency ID.");
    }

    private validateObjectId(value: string, message: string): void {
        if (!Types.ObjectId.isValid(value)) {
            throw new AppError(message, 400);
        }
    }

    private validateOptionalObjectId(
        value: Types.ObjectId | string | null | undefined,
        message: string,
    ): void {
        if (value === undefined || value === null) {
            return;
        }

        if (!Types.ObjectId.isValid(value.toString())) {
            throw new AppError(message, 400);
        }
    }

    /**
     * Resolves profile image metadata and authorized download/public URL
     */
    private async resolveProfileImageSummary(
        profileImageId: unknown,
        mediaPreloadMap?: Map<string, any>,
    ): Promise<IProfileImageSummary | null> {
        if (!profileImageId) {
            return null;
        }

        const idStr =
            profileImageId instanceof Types.ObjectId ? profileImageId.toString() : String(profileImageId);

        if (!Types.ObjectId.isValid(idStr)) {
            return null;
        }

        let mediaDoc = mediaPreloadMap?.get(idStr);
        if (!mediaDoc) {
            mediaDoc = await this.mediaRepository.findById(idStr, true);
        }

        if (!mediaDoc || mediaDoc.status === MediaStatus.DELETED) {
            return null;
        }

        let url: string;
        try {
            if (mediaDoc.visibility === MediaVisibility.PUBLIC && mediaDoc.publicUrl) {
                url = mediaDoc.publicUrl;
            } else if (mediaDoc.visibility === MediaVisibility.PUBLIC) {
                url = this.storageService.getPublicUrl(mediaDoc.storageKey);
            } else {
                url = await this.storageService.createDownloadUrl(mediaDoc.storageKey);
            }
        } catch {
            return null;
        }

        return {
            id: idStr,
            url,
        };
    }

    private async toResponse(profile: any, mediaPreloadMap?: Map<string, any>): Promise<IUserProfileResponse> {
        const data = typeof profile?.toObject === "function" ? profile.toObject() : profile;

        const profileImageSummary = await this.resolveProfileImageSummary(
            data.profileImage,
            mediaPreloadMap,
        );

        return {
            id: this.getRequiredId(data._id),
            userId: this.getRequiredId(data.userId),
            firstName: data.firstName,
            lastName: data.lastName,
            displayName: data.displayName ?? null,
            bio: data.bio ?? null,
            dateOfBirth: data.dateOfBirth ?? null,
            profileType: data.profileType,
            occupation: data.occupation ?? null,
            education: data.education ?? null,
            interests: Array.isArray(data.interests) ? data.interests : [],
            countryId: this.getOptionalId(data.countryId),
            timezoneId: this.getOptionalId(data.timezoneId),
            languageId: this.getOptionalId(data.languageId),
            currencyId: this.getOptionalId(data.currencyId),
            profileImage: profileImageSummary,
            avatarUrl: profileImageSummary?.url ?? null,
        };
    }

    private getOptionalId(value: unknown): string | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === "string") {
            return value;
        }

        if (typeof value === "object") {
            const objectValue = value as {
                _id?: unknown;
            };

            if (objectValue._id) {
                return this.getOptionalId(objectValue._id);
            }
        }

        return null;
    }

    private getRequiredId(value: unknown): string {
        const id = this.getOptionalId(value);

        if (!id) {
            throw new AppError("Invalid profile response ID.", 500);
        }

        return id;
    }

    private buildAuditChanges(profile: any, updateData: IUserProfileUpdate) {
        return Object.keys(updateData)
            .filter(
                (field) => !this.valuesEqual(profile[field], (updateData as Record<string, unknown>)[field]),
            )
            .map((field) => ({
                field,
                oldValue: this.sanitizeAuditValue(field, profile[field]),
                newValue: this.sanitizeAuditValue(field, (updateData as Record<string, unknown>)[field]),
            }));
    }

    private valuesEqual(left: unknown, right: unknown): boolean {
        return (
            JSON.stringify(this.normalizeComparisonValue(left)) ===
            JSON.stringify(this.normalizeComparisonValue(right))
        );
    }

    private normalizeComparisonValue(value: unknown): unknown {
        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeComparisonValue(item));
        }

        if (value && typeof value === "object" && "_id" in value) {
            return this.getOptionalId(value);
        }

        return value;
    }

    private async runAuditSafely(
        operation: string,
        writer: () => Promise<void>,
        metadata: Record<string, unknown> = {},
    ): Promise<void> {
        try {
            await writer();
        } catch (error) {
            console.error(`UserProfile audit logging failed after ${operation}.`, {
                ...metadata,
                error,
            });
        }
    }

    private isDuplicateKeyError(error: unknown): boolean {
        if (!error || typeof error !== "object") {
            return false;
        }

        const mongoError = error as {
            code?: unknown;
        };

        return mongoError.code === 11000;
    }

    private isLegacyUserProfileIndexError(error: unknown): boolean {
        if (!this.isDuplicateKeyError(error)) {
            return false;
        }

        const mongoError = error as {
            message?: unknown;
            keyPattern?: Record<string, unknown>;
            keyValue?: Record<string, unknown>;
        };

        const message = typeof mongoError.message === "string" ? mongoError.message : "";

        return (
            mongoError.keyPattern?.["user"] === 1 ||
            (Object.prototype.hasOwnProperty.call(mongoError.keyValue ?? {}, "user") &&
                mongoError.keyValue?.["user"] === null) ||
            message.includes("index: user_1")
        );
    }

    private sanitizeAuditValue(field: string, value: unknown): unknown {
        const sensitiveFields = [
            "password",
            "currentPassword",
            "newPassword",
            "confirmPassword",
            "token",
            "accessToken",
            "refreshToken",
            "apiKey",
            "secret",
            "secretKey",
            "otp",
            "authorization",
            "mfaSecret",
            "passwordResetTokenHash",
            "emailVerificationTokenHash",
        ];

        if (sensitiveFields.includes(field)) {
            return "[REDACTED]";
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (["countryId", "timezoneId", "languageId", "currencyId", "userId", "profileImage"].includes(field)) {
            return this.getOptionalId(value);
        }

        return value;
    }
}
