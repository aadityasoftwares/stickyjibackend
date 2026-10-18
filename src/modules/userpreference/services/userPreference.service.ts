import { Types } from "mongoose";
import type {
    IUserPreferenceDocument,
    IUserPreferenceFilter,
    IUserPreferenceResponse,
    UserPreferenceValue,
} from "../interfaces/userPreference.interface.js";
import {
    USER_PREFERENCE_DEFINITIONS,
    USER_PREFERENCE_KEYS,
} from "../constants/userPreference.constants.js";
import {
    UserPreferenceCategory,
    WorkspaceAccessFilter,
} from "../constants/userPreference.enums.js";
import { UserPreferenceValidation } from "../validations/userPreference.validation.js";
import { UserPreferenceRepository } from "../repositories/userPreference.repository.js";
import { UserPreferenceMessages } from "../constants/userPreference.messages.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { AppError } from "../../../utils/errors/app.error.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";

export class UserPreferenceService {
    private userPreferenceRepository: UserPreferenceRepository;
    private auditLogService: AuditLogService;

    constructor() {
        this.userPreferenceRepository = new UserPreferenceRepository();
        this.auditLogService = new AuditLogService();
    }

    async createUserPreference(
        userId: string,
        data: {
            key: string;
            value: unknown;
        },
        context?: IAuditLogContext,
    ): Promise<IUserPreferenceResponse> {

        this.validateUserId(userId);

        const canonicalKey = this.getCanonicalKey(data.key);
        const storageKey = UserPreferenceValidation.getStorageKey(canonicalKey);
        const definition = UserPreferenceValidation.getDefinition(canonicalKey);

        if (!definition) {
            throw new AppError(UserPreferenceMessages.INVALID_KEY, 400);
        }

        if (data.value === undefined) {
            throw new AppError(UserPreferenceMessages.VALUE_REQUIRED, 400);
        }

        if (!UserPreferenceValidation.isValidValue(data.value, definition.type)) {
            throw new AppError(UserPreferenceMessages.INVALID_VALUE, 400);
        }

        // Normalize then domain-validate
        const normalizedValue = UserPreferenceValidation.normalizeValue(
            canonicalKey,
            data.value as UserPreferenceValue,
        );
        const domainError = UserPreferenceValidation.validateDomainValue(canonicalKey, normalizedValue);

        if (domainError) {
            throw new AppError(domainError, 400);
        }

        const exists = await this.userPreferenceRepository.existsByUserIdAndKey(userId, storageKey);

        if (exists) {
            throw new AppError(UserPreferenceMessages.ALREADY_EXISTS, 409);
        }

        const preference = await this.userPreferenceRepository.create({
            userId: new Types.ObjectId(userId),
            key: storageKey,
            value: normalizedValue,
            valueType: definition.type,
            category: definition.category,
        });

        await this.auditLogService.logCreate(
            context ?? {},
            {
                module: AppModule.USER_PREFERENCE,
                resourceId: preference._id.toString(),
                resourceName: canonicalKey,
            },
            `User preference ${canonicalKey} was created successfully.`,
        );

        return this.toResponse(preference, canonicalKey);
    }

    async provisionMissingPreferences(userId: string): Promise<void> {

        this.validateUserId(userId);

        const definitions = Object.entries(USER_PREFERENCE_DEFINITIONS).map(
            ([key, definition]) => ({
                key: UserPreferenceValidation.getStorageKey(key),
                value: definition.defaultValue as UserPreferenceValue,
                valueType: definition.type,
                category: definition.category,
            }),
        );

        await this.userPreferenceRepository.provisionMissingPreferences(userId, definitions);
        await this.migrateLegacyWorkspaceFilters(userId);
    }

    async getUserPreference(userId: string, key: string): Promise<IUserPreferenceResponse> {

        this.validateUserId(userId);

        const canonicalKey = this.getCanonicalKey(key);
        if (this.isWorkspaceFilterKey(canonicalKey)) {
            await this.migrateLegacyWorkspaceFilters(userId);
        }
        const storageKey = UserPreferenceValidation.getStorageKey(canonicalKey);
        const preference = await this.userPreferenceRepository.findByUserIdAndKey(userId, storageKey);

        if (!preference) {
            throw new AppError(UserPreferenceMessages.NOT_FOUND, 404);
        }

        return this.toResponse(preference, canonicalKey);
    }

    async getUserPreferences(
        userId: string,
        filters: IUserPreferenceFilter = {},
    ): Promise<IUserPreferenceResponse[]> {

        this.validateUserId(userId);

        let canonicalFilterKey: string | undefined;

        if (filters.key) {
            const canonicalKey = this.getCanonicalKey(filters.key);
            canonicalFilterKey = canonicalKey;
            filters.key = UserPreferenceValidation.getStorageKey(canonicalKey);
        }

        if (
            (!filters.category || filters.category === UserPreferenceCategory.WORKSPACE) &&
            (!canonicalFilterKey || this.isWorkspaceFilterKey(canonicalFilterKey))
        ) {
            await this.migrateLegacyWorkspaceFilters(userId);
        }

        const preferences = await this.userPreferenceRepository.findAllByUserId(userId, filters);

        return preferences.map((preference) => {
            const canonicalKey =
                UserPreferenceValidation.getCanonicalKey(preference.key) ?? preference.key;
            return this.toResponse(preference, canonicalKey);
        });
    }

    async updateUserPreference(
        userId: string,
        key: string,
        data: { value: unknown },
        context?: IAuditLogContext,
    ): Promise<IUserPreferenceResponse> {

        this.validateUserId(userId);

        const canonicalKey = this.getCanonicalKey(key);
        const definition = UserPreferenceValidation.getDefinition(canonicalKey);

        if (!definition) {
            throw new AppError(UserPreferenceMessages.INVALID_KEY, 400);
        }

        if (data.value === undefined) {
            throw new AppError(UserPreferenceMessages.VALUE_REQUIRED, 400);
        }

        if (!UserPreferenceValidation.isValidValue(data.value, definition.type)) {
            throw new AppError(UserPreferenceMessages.INVALID_VALUE, 400);
        }

        // Normalize then domain-validate before any DB work
        const normalizedValue = UserPreferenceValidation.normalizeValue(
            canonicalKey,
            data.value as UserPreferenceValue,
        );
        const domainError = UserPreferenceValidation.validateDomainValue(canonicalKey, normalizedValue);

        if (domainError) {
            throw new AppError(domainError, 400);
        }

        const storageKey = UserPreferenceValidation.getStorageKey(canonicalKey);
        const preference = await this.userPreferenceRepository.findByUserIdAndKey(userId, storageKey);

        if (!preference) {
            throw new AppError(UserPreferenceMessages.NOT_FOUND, 404);
        }

        const oldValue = preference.value;

        // Skip DB write if normalized value is unchanged (avoids noisy audit logs)
        if (String(oldValue) === String(normalizedValue) &&
            JSON.stringify(oldValue) === JSON.stringify(normalizedValue)
        ) {
            return this.toResponse(preference, canonicalKey);
        }

        const updatedPreference = await this.userPreferenceRepository.updateByUserIdAndKey(
            userId,
            storageKey,
            { value: normalizedValue },
        );

        if (!updatedPreference) {
            throw new AppError(UserPreferenceMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logUpdate(
            context ?? {},
            {
                module: AppModule.USER_PREFERENCE,
                resourceId: updatedPreference._id.toString(),
                resourceName: canonicalKey,
            },
            `User preference ${canonicalKey} was updated successfully.`,
            [{
                field: "value",
                oldValue,
                newValue: normalizedValue,
            }],
        );

        return this.toResponse(updatedPreference, canonicalKey);
    }

    async deleteUserPreference(
        userId: string,
        key: string,
        context?: IAuditLogContext,
    ): Promise<IUserPreferenceResponse> {

        this.validateUserId(userId);

        const canonicalKey = this.getCanonicalKey(key);
        const storageKey = UserPreferenceValidation.getStorageKey(canonicalKey);
        const preference = await this.userPreferenceRepository.deleteByUserIdAndKey(userId, storageKey);

        if (!preference) {
            throw new AppError(UserPreferenceMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logDelete(
            context ?? {},
            {
                module: AppModule.USER_PREFERENCE,
                resourceId: preference._id.toString(),
                resourceName: canonicalKey,
            },
            `User preference ${canonicalKey} was deleted successfully.`,
        );

        return this.toResponse(preference, canonicalKey);
    }

    async resetUserPreference(
        userId: string,
        key: string,
        context?: IAuditLogContext,
    ): Promise<IUserPreferenceResponse | null> {

        this.validateUserId(userId);

        const canonicalKey = this.getCanonicalKey(key);
        const definition = UserPreferenceValidation.getDefinition(canonicalKey);

        if (!definition) {
            throw new AppError(UserPreferenceMessages.INVALID_KEY, 400);
        }

        const storageKey = UserPreferenceValidation.getStorageKey(canonicalKey);
        const preference = await this.userPreferenceRepository.findByUserIdAndKey(userId, storageKey);

        if (!preference) {
            return null;
        }

        const oldValue = preference.value;
        const defaultValue = definition.defaultValue as UserPreferenceValue;

        if (JSON.stringify(oldValue) === JSON.stringify(defaultValue)) {
            return this.toResponse(preference, canonicalKey);
        }

        const updatedPreference = await this.userPreferenceRepository.updateByUserIdAndKey(
            userId,
            storageKey,
            { value: defaultValue },
        );

        if (!updatedPreference) {
            throw new AppError(UserPreferenceMessages.NOT_FOUND, 404);
        }

        await this.auditLogService.logUpdate(
            context ?? {},
            {
                module: AppModule.USER_PREFERENCE,
                resourceId: updatedPreference._id.toString(),
                resourceName: canonicalKey,
            },
            `User preference ${canonicalKey} was reset successfully.`,
            [{
                field: "value",
                oldValue,
                newValue: defaultValue,
            }],
        );

        return this.toResponse(updatedPreference, canonicalKey);
    }

    async resetAllUserPreferences(
        userId: string,
        context?: IAuditLogContext,
    ): Promise<IUserPreferenceResponse[]> {

        this.validateUserId(userId);

        const preferences = await this.userPreferenceRepository.findAllByUserId(userId);

        const changes: Array<{
            key: string;
            oldValue: UserPreferenceValue;
            newValue: UserPreferenceValue;
        }> = [];

        const updates: Array<{
            key: string;
            value: UserPreferenceValue;
        }> = [];

        for (const preference of preferences) {
            const canonicalKey = UserPreferenceValidation.getCanonicalKey(preference.key);

            if (!canonicalKey) {
                continue;
            }

            const definition = UserPreferenceValidation.getDefinition(canonicalKey);

            if (!definition) {
                continue;
            }

            const defaultValue = definition.defaultValue as UserPreferenceValue;

            if (JSON.stringify(preference.value) === JSON.stringify(defaultValue)) {
                continue;
            }

            changes.push({
                key: canonicalKey,
                oldValue: preference.value,
                newValue: defaultValue,
            });

            updates.push({
                key: UserPreferenceValidation.getStorageKey(canonicalKey),
                value: defaultValue,
            });
        }

        if (updates.length) {
            await this.userPreferenceRepository.updatePreferenceValues(userId, updates);
        }

        if (changes.length) {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module: AppModule.USER_PREFERENCE,
                    resourceId: userId,
                    resourceName: "ALL_PREFERENCES",
                },
                "User preferences were reset successfully.",
                changes.map((change) => ({
                    field: change.key,
                    oldValue: change.oldValue,
                    newValue: change.newValue,
                })),
            );
        }

        return this.getUserPreferences(userId);
    }

    /**
     * Returns a flat key→value map of all localization preferences for a user.
     * Designed for consumption by a bootstrap/session-context endpoint.
     * Only includes keys that have been provisioned (i.e. exist in DB).
     */
    async getLocalizationPreferences(
        userId: string,
    ): Promise<Record<string, UserPreferenceValue>> {
        this.validateUserId(userId);

        const { UserPreferenceCategory } = await import(
            "../constants/userPreference.enums.js"
        );

        const preferences = await this.userPreferenceRepository.findAllByUserId(userId, {
            category: UserPreferenceCategory.LOCALIZATION,
        });

        const result: Record<string, UserPreferenceValue> = {};

        for (const preference of preferences) {
            const canonicalKey =
                UserPreferenceValidation.getCanonicalKey(preference.key) ?? preference.key;
            result[canonicalKey] = preference.value;
        }

        return result;
    }

    private validateUserId(userId: string): void {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(UserPreferenceMessages.INVALID_USER_ID, 400);
        }
    }

    /**
     * Older clients stored OWNED/SHARED in workspaceStatusFilter. Move that
     * value to workspaceAccessFilter once, without replacing a newer explicit
     * access selection, and restore the status preference to its default.
     */
    private async migrateLegacyWorkspaceFilters(userId: string): Promise<void> {
        const statusKey = UserPreferenceValidation.getStorageKey(
            USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER,
        );
        const accessKey = UserPreferenceValidation.getStorageKey(
            USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER,
        );
        const preferences = await this.userPreferenceRepository.findAllByUserId(userId, {
            category: UserPreferenceCategory.WORKSPACE,
        });
        const statusPreference = preferences.find((preference) => preference.key === statusKey);
        const legacyAccess = statusPreference?.value === WorkspaceAccessFilter.OWNED ||
            statusPreference?.value === WorkspaceAccessFilter.SHARED
            ? statusPreference.value
            : null;

        if (!legacyAccess) {
            return;
        }

        const accessPreference = preferences.find((preference) => preference.key === accessKey);
        const updates: Array<{ key: string; value: UserPreferenceValue }> = [{
            key: statusKey,
            value: USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER].defaultValue,
        }];

        if (!accessPreference) {
            const definition = USER_PREFERENCE_DEFINITIONS[USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER];
            await this.userPreferenceRepository.provisionMissingPreferences(userId, [{
                key: accessKey,
                value: legacyAccess,
                valueType: definition.type,
                category: definition.category,
            }]);
        } else if (accessPreference.value === WorkspaceAccessFilter.ALL) {
            updates.push({ key: accessKey, value: legacyAccess });
        }

        await this.userPreferenceRepository.updatePreferenceValues(userId, updates);
    }

    private isWorkspaceFilterKey(key: string): boolean {
        return key === USER_PREFERENCE_KEYS.WORKSPACE_STATUS_FILTER ||
            key === USER_PREFERENCE_KEYS.WORKSPACE_ACCESS_FILTER;
    }

    private getCanonicalKey(key: string): string {
        const canonicalKey = UserPreferenceValidation.getCanonicalKey(key);

        if (!canonicalKey) {
            throw new AppError(UserPreferenceMessages.INVALID_KEY, 400);
        }

        return canonicalKey;
    }

    private toResponse(
        preference: Pick<IUserPreferenceDocument, "_id" | "key" | "value">,
        canonicalKey?: string,
    ): IUserPreferenceResponse {
        return {
            id: preference._id.toString(),
            key: canonicalKey ?? UserPreferenceValidation.getCanonicalKey(preference.key) ?? preference.key,
            value: preference.value,
        };
    }
}
