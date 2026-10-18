import { Types } from "mongoose";

import type {
    IUserProfileCreate,
    IUserProfileFilter,
    IUserProfileUpdate,
} from "../interfaces/userProfile.interface.js";

import { UserProfileRepository } from "../repositories/userProfile.repository.js";

import { UserRepository } from "../../user/repositories/user.repository.js";

import { UserProfileMessages } from "../constants/userProfile.messages.js";

import { AppError } from "../../../utils/errors/app.error.js";

import { StringHelper } from "../../../utils/helpers/string.helper.js";

import { AuditLogService } from "../../auditlog/services/auditLog.service.js";

import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

import { AppModule } from "../../../utils/enums/appModule.enums.js";

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

    constructor() {
        this.userProfileRepository = new UserProfileRepository();

        this.userRepository = new UserRepository();

        this.auditLogService = new AuditLogService();
    }

    async createProfile(data: IUserProfileCreate, context?: IAuditLogContext): Promise<IUserProfileResponse> {
        const userId = data.userId.toString();

        this.validateObjectId(userId, "Invalid user ID.");

        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new AppError(UserProfileMessages.USER_NOT_FOUND, 404);
        }

        /*
         * Application-level duplicate check gives a clean
         * response in the normal case.
         *
         * MongoDB's unique userId index remains the final
         * protection against concurrent requests.
         */
        const existingProfile = await this.userProfileRepository.existsByUserId(userId);

        if (existingProfile) {
            throw new AppError(UserProfileMessages.ALREADY_EXISTS, 409);
        }

        /*
         * Validate relation IDs before MongoDB receives
         * them. This prevents CastError responses.
         */
        this.validateRelationIds(data);

        const firstName = StringHelper.normalize(data.firstName);

        const lastName = StringHelper.normalize(data.lastName);

        const profileData: IUserProfileCreate = {
            ...data,

            /*
             * IMPORTANT:
             *
             * The current schema field is userId.
             * Do not write the old legacy field "user".
             */
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
        };

        let profile: Awaited<ReturnType<UserProfileRepository["create"]>>;

        try {
            profile = await this.userProfileRepository.create(profileData);
        } catch (error) {
            /*
             * If MongoDB still contains the old unique
             * index:
             *
             *     user_1
             *
             * every new document that only contains
             * userId is treated as user:null by that
             * obsolete index. Never expose the raw Mongo
             * error to the frontend.
             *
             * The database migration must drop user_1
             * and keep userId_1 unique.
             */
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

            /*
             * Handles the race where two profile-create
             * requests pass existsByUserId() at the same
             * time. MongoDB's unique index wins and we
             * translate it into the expected API response.
             */
            if (this.isDuplicateKeyError(error)) {
                throw new AppError(UserProfileMessages.ALREADY_EXISTS, 409);
            }

            throw error;
        }

        if (!profile) {
            throw new AppError("Unable to create user profile.", 500);
        }

        /*
         * Persistence succeeded at this point.
         *
         * Audit logging must not make the API report
         * "profile creation failed" after MongoDB has
         * already created the profile. This is especially
         * important during signup, because AuthService can
         * now safely decide whether registration needs to
         * be rolled back based on the real critical write.
         */
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
        /*
         * Validate ObjectId filters before repository.
         */
        this.validateFilterIds(filters);

        if (filters.search) {
            filters.search = StringHelper.normalizeWhitespace(filters.search);
        }

        /*
         * Do not allow arbitrary Mongo sort fields
         * from query parameters.
         */
        if (filters.sortBy && !USER_PROFILE_SORT_FIELDS.has(filters.sortBy)) {
            filters.sortBy = "createdAt";
        }

        const result = await this.userProfileRepository.findAll(filters);

        return {
            data: result.data.map((profile) => this.toResponse(profile)),

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

        const updateData = this.normalizeUpdateData(data);

        const changes = this.buildAuditChanges(profile, updateData);

        const updatedProfile = await this.userProfileRepository.updateByUserId(userId, updateData);

        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            /*
             * The update is already persisted.
             * Audit failure must not turn a successful
             * profile update into a failed API response.
             */
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

        const updateData = this.normalizeUpdateData(data);

        const changes = this.buildAuditChanges(profile, updateData);

        const updatedProfile = await this.userProfileRepository.updateByUserId(
            profile.userId.toString(),
            updateData,
        );

        if (!updatedProfile) {
            throw new AppError(UserProfileMessages.NOT_FOUND, 404);
        }

        if (changes.length > 0) {
            /*
             * The update is already persisted.
             * Audit failure must not turn a successful
             * profile update into a failed API response.
             */
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

                    userId: profile.userId.toString(),
                },
            );
        }

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

    /*
     * Validate optional profile relation IDs.
     *
     * null is allowed because user may clear
     * optional values.
     */
    private validateRelationIds(data: IUserProfileCreate | IUserProfileUpdate): void {
        this.validateOptionalObjectId(data.countryId, "Invalid country ID.");

        this.validateOptionalObjectId(data.timezoneId, "Invalid timezone ID.");

        this.validateOptionalObjectId(data.languageId, "Invalid language ID.");

        this.validateOptionalObjectId(data.currencyId, "Invalid currency ID.");
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

    /*
     * Converts profile into exactly what Angular
     * should receive.
     *
     * Even if someone accidentally adds populate()
     * in repository later, this method still only
     * returns relation IDs.
     */
    private toResponse(profile: any): IUserProfileResponse {
        const data = typeof profile?.toObject === "function" ? profile.toObject() : profile;

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
        };
    }

    /*
     * Supports:
     *
     * ObjectId
     * string
     * populated mongoose document
     * plain populated object
     */
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

    /*
     * Audit logging is important, but it is not the
     * primary persistence operation for a profile.
     *
     * Once a profile create/update has succeeded, an
     * audit infrastructure problem must not make the
     * client think the profile write failed.
     */
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

    /*
     * MongoDB duplicate-key detection without coupling
     * this service to a specific driver error class.
     */
    private isDuplicateKeyError(error: unknown): boolean {
        if (!error || typeof error !== "object") {
            return false;
        }

        const mongoError = error as {
            code?: unknown;
        };

        return mongoError.code === 11000;
    }

    /*
     * Detect the exact legacy-index problem:
     *
     *   index: user_1
     *   dup key: { user: null }
     *
     * Current documents use "userId", therefore that old
     * unique "user" index must not remain in MongoDB.
     */
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

        /*
         * If relation was populated, audit only ID.
         */
        if (["countryId", "timezoneId", "languageId", "currencyId", "userId"].includes(field)) {
            return this.getOptionalId(value);
        }

        return value;
    }
}
