import { Types, type ClientSession } from "mongoose";
import { permissionAuthorizationService } from "../../permissions/services/permissionAuthorization.service.js";
import { AppError } from "../../../utils/errors/app.error.js";
import { FeatureCode } from "../../feature/constants/feature.enums.js";
import { MediaResourceType } from "../../media/constants/media.enums.js";
import { BillingScopeType } from "../../subscriptionusage/constants/subscriptionusage.enums.js";
import { SubscriptionUsageService } from "../../subscriptionusage/services/subscriptionusage.service.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";
import { SubscriptionEntitlementRepository } from "../repositories/subscriptionentitlement.repository.js";
import {
    EntitlementDecisionReason,
    EntitlementErrorCode,
    ReservationStatus,
} from "../constants/subscriptionentitlement.enums.js";
import {
    RESOURCE_CAPABILITIES,
    SUBSCRIPTION_ENTITLEMENT_CONSTANTS,
} from "../constants/subscriptionentitlement.constants.js";
import { SubscriptionEntitlementMessages } from "../constants/subscriptionentitlement.messages.js";
import type { IBillingScope } from "../../subscriptionusage/interfaces/subscriptionusage.interface.js";
import type {
    ICheckEntitlementInput,
    IEntitlementDecision,
    IPlanEntitlementSummary,
    IPlanLimitValue,
    IReservationResult,
    ISubscriptionReservation,
    PlanLimitsMap,
} from "../interfaces/subscriptionentitlement.interface.js";

export class SubscriptionEntitlementService {
    constructor(
        private readonly repository = new SubscriptionEntitlementRepository(),
        private readonly userSubscriptionService = new UserSubscriptionService(),
        private readonly subscriptionUsageService = new SubscriptionUsageService(),
    ) {}

    /** Capability checks complement authorization; they never grant resource access. */
    async assertFeatureEnabled(
        scope: IBillingScope,
        feature: FeatureCode,
        session?: ClientSession,
        limits?: PlanLimitsMap,
    ) {
        const config = await this.getResourceLimit(scope, feature, session, limits);
        if (!config.isEnabled) {
            throw new AppError(
                `The ${feature.toLowerCase().replaceAll("_", " ")} feature is not enabled for this plan.`,
                403,
                EntitlementErrorCode.SUBSCRIPTION_FEATURE_DISABLED,
            );
        }
    }

    async assertWorkspaceFeature(workspaceId: string, feature: FeatureCode, session?: ClientSession) {
        const id = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );
        const ownerId = await this.repository.findWorkspaceOwner(id, session);
        if (!ownerId) throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        await this.assertFeatureEnabled(
            { type: BillingScopeType.USER, id: String(ownerId) },
            feature,
            session,
        );
    }

    async assertNoteFeature(noteId: string, feature: FeatureCode, session?: ClientSession) {
        const id = this.assertValidObjectId(noteId, SubscriptionEntitlementMessages.INVALID_NOTE_ID);
        const info = await this.repository.findNoteWorkspaceAndOwner(id, session);
        if (!info) throw new AppError(SubscriptionEntitlementMessages.NOTE_NOT_FOUND, 404);
        await this.assertFeatureEnabled(
            { type: BillingScopeType.USER, id: String(info.ownerId) },
            feature,
            session,
        );
    }

    private effectiveLimit(config: IPlanLimitValue): number {
        if (!config.isEnabled) return 0;
        if (config.isUnlimited) return Infinity;
        if (!Number.isSafeInteger(config.limit) || config.limit < 0) {
            throw new AppError(
                SubscriptionEntitlementMessages.CONFIGURATION_ERROR,
                500,
                EntitlementErrorCode.CONFIGURATION_ERROR,
            );
        }
        return config.limit;
    }

    private validateScope(scope: IBillingScope): Types.ObjectId {
        if (!scope || !scope.type || !Object.values(BillingScopeType).includes(scope.type)) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_SCOPE, 400);
        }
        if (!scope.id || !Types.ObjectId.isValid(scope.id)) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_USER_ID, 400);
        }
        return new Types.ObjectId(scope.id);
    }

    private assertValidObjectId(id: string, errorMessage: string): Types.ObjectId {
        if (!id || !Types.ObjectId.isValid(id)) {
            throw new AppError(errorMessage, 400);
        }
        return new Types.ObjectId(id);
    }

    /**
     * Resolves the authoritative effective subscription and plan limits for a given billing scope.
     * Temporary database failures do not silently downgrade paid subscriptions.
     */
    async resolveEffectivePlanLimits(
        scope: IBillingScope,
        session?: ClientSession,
    ): Promise<{
        planId: Types.ObjectId;
        planCode: string;
        planName: string;
        accessState: string;
        subscriptionId: string | null;
        currentPeriodEnd: Date | null;
        cancelAtPeriodEnd: boolean;
        limits: PlanLimitsMap;
    }> {
        this.validateScope(scope);

        // Current personal plans are scoped to user. Future team subscriptions resolve organization owner.
        const effectiveSub = await this.userSubscriptionService.getCurrentSubscription(scope.id);
        if (!effectiveSub || !effectiveSub.effectivePlan) {
            throw new AppError(
                SubscriptionEntitlementMessages.SUBSCRIPTION_UNAVAILABLE,
                500,
                EntitlementErrorCode.SUBSCRIPTION_UNAVAILABLE,
            );
        }

        const effectivePlan = effectiveSub.effectivePlan;
        const limits = await this.repository.findPlanLimits(effectivePlan._id, session);

        return {
            planId: effectivePlan._id,
            planCode: effectivePlan.code,
            planName: effectivePlan.name,
            accessState: effectiveSub.accessState,
            subscriptionId: effectiveSub.subscription?._id ? String(effectiveSub.subscription._id) : null,
            currentPeriodEnd: effectiveSub.subscription?.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: effectiveSub.subscription?.cancelAtPeriodEnd ?? false,
            limits,
        };
    }

    /**
     * Retrieves a specific resource limit value for a scope.
     * If a required quota feature is not configured in PlanFeature, fails safely.
     */
    async getResourceLimit(
        scope: IBillingScope,
        resourceCode: string,
        session?: ClientSession,
        resolvedLimits?: PlanLimitsMap,
    ): Promise<IPlanLimitValue> {
        const limits = resolvedLimits ?? (await this.resolveEffectivePlanLimits(scope, session)).limits;
        const limitConfig = limits[resourceCode];

        if (!limitConfig) {
            console.error(
                `[SubscriptionEntitlement] Missing plan feature limit for resource: ${resourceCode}`,
            );
            throw new AppError(
                SubscriptionEntitlementMessages.CONFIGURATION_ERROR,
                500,
                EntitlementErrorCode.CONFIGURATION_ERROR,
            );
        }

        return limitConfig;
    }

    /**
     * Returns an Angular-friendly overview of current plan entitlements and usage.
     */
    async getMyEntitlements(
        actorId: string,
        options?: { fresh?: boolean },
    ): Promise<IPlanEntitlementSummary> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: actorId,
        };
        return this.getEntitlementsByScope(scope, options);
    }

    async getWorkspaceEntitlements(actorId: string, workspaceId: string) {
        await permissionAuthorizationService.resolveWorkspaceAuthorization(actorId, workspaceId);
        const ownerId = await this.repository.findWorkspaceOwner(workspaceId);
        if (!ownerId) throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        const scope = { type: BillingScopeType.USER, id: String(ownerId) };
        const summary = await this.getEntitlementsByScope(scope, { fresh: true });
        const folders = await this.getWorkspaceFolderEntitlements(actorId, workspaceId);
        return {
            ...summary,
            workspaceId,
            billingScope: scope,
            resources: { ...summary.resources, [FeatureCode.MAX_FOLDERS_PER_WORKSPACE]: folders },
        };
    }

    /**
     * Returns entitlements by billing scope.
     */
    async getEntitlementsByScope(
        scope: IBillingScope,
        options?: { fresh?: boolean },
    ): Promise<IPlanEntitlementSummary> {
        const {
            planCode,
            planName,
            accessState,
            subscriptionId,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            limits,
        } = await this.resolveEffectivePlanLimits(scope);

        const usage = await this.subscriptionUsageService.getUsageSummary(scope, { fresh: true, ...options });

        const resources: IPlanEntitlementSummary["resources"] = {};
        const usedByResource: Record<string, number> = {
            [FeatureCode.MAX_WORKSPACES]: usage.workspacesUsed,
            [FeatureCode.MAX_ACTIVE_STICKY_NOTES]: usage.activeStickyNotesUsed,
            [FeatureCode.MAX_STORAGE_BYTES]: usage.storageBytesUsed,
            [FeatureCode.MAX_USERS]: usage.usersUsed,
        };
        for (const code of SUBSCRIPTION_ENTITLEMENT_CONSTANTS.QUOTA_RESOURCES) {
            const config = limits[code];
            if (!config) continue;
            const limit = this.effectiveLimit(config);
            const isUnlimited = config.isEnabled && config.isUnlimited;
            const used = usedByResource[code];
            resources[code] = {
                limit: isUnlimited ? null : limit,
                isUnlimited,
                isEnabled: config.isEnabled,
                ...(used === undefined
                    ? {}
                    : {
                          used,
                          remaining: isUnlimited ? null : Math.max(0, limit - used),
                          overLimit: !isUnlimited && used > limit,
                      }),
            };
        }

        return {
            planCode,
            planName,
            accessState,
            subscriptionId,
            currentPeriodEnd,
            cancelAtPeriodEnd,
            resources,
            features: Object.fromEntries(
                Object.entries(limits)
                    .filter(
                        ([code]) =>
                            !SUBSCRIPTION_ENTITLEMENT_CONSTANTS.QUOTA_RESOURCES.includes(code as FeatureCode),
                    )
                    .map(([code, config]) => [code, config.isEnabled]),
            ),
        };
    }

    /**
     * Non-mutating informational resource availability check for frontend pre-checks.
     */
    async checkResourceAvailability(
        actorId: string,
        input: ICheckEntitlementInput,
    ): Promise<IEntitlementDecision> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);

        const resourceCode = input.resourceCode;
        const requestedAmount = input.requestedAmount ?? 1;
        if (
            !Number.isSafeInteger(requestedAmount) ||
            requestedAmount <= 0 ||
            (input.fileSize !== undefined && (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0))
        ) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_QUANTITY, 400);
        }

        if (!SUBSCRIPTION_ENTITLEMENT_CONSTANTS.QUOTA_RESOURCES.includes(resourceCode as FeatureCode)) {
            return {
                allowed: false,
                resourceCode,
                currentUsage: 0,
                limit: 0,
                requestedAmount,
                remaining: 0,
                reason: EntitlementDecisionReason.INVALID_RESOURCE,
                message: SubscriptionEntitlementMessages.INVALID_RESOURCE,
            };
        }

        // Resolve scope: if workspaceId is provided, resolve workspace owner
        let scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: actorId,
        };

        let workspaceObjectId: Types.ObjectId | null = null;
        if (input.workspaceId) {
            workspaceObjectId = this.assertValidObjectId(
                input.workspaceId,
                SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
            );
            await permissionAuthorizationService.resolveWorkspaceAuthorization(actorId, input.workspaceId);
            const ownerId = await this.repository.findWorkspaceOwner(workspaceObjectId);
            if (!ownerId) {
                return {
                    allowed: false,
                    resourceCode,
                    currentUsage: 0,
                    limit: 0,
                    requestedAmount,
                    remaining: 0,
                    reason: EntitlementDecisionReason.CONFIGURATION_ERROR,
                    message: SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND,
                };
            }
            scope = {
                type: BillingScopeType.USER,
                id: ownerId.toString(),
            };
        }

        let limitConfig: IPlanLimitValue;
        try {
            const { limits } = await this.resolveEffectivePlanLimits(scope);
            const capability = RESOURCE_CAPABILITIES[resourceCode as FeatureCode];
            if (capability) await this.assertFeatureEnabled(scope, capability, undefined, limits);
            limitConfig = await this.getResourceLimit(scope, resourceCode, undefined, limits);
        } catch (error) {
            const disabled =
                error instanceof AppError &&
                error.code === EntitlementErrorCode.SUBSCRIPTION_FEATURE_DISABLED;
            return {
                allowed: false,
                resourceCode,
                currentUsage: 0,
                limit: 0,
                requestedAmount,
                remaining: 0,
                reason: disabled
                    ? EntitlementDecisionReason.FEATURE_DISABLED
                    : EntitlementDecisionReason.CONFIGURATION_ERROR,
                message: disabled ? error.message : SubscriptionEntitlementMessages.CONFIGURATION_ERROR,
            };
        }

        const effectiveLimit = this.effectiveLimit(limitConfig);

        // Check single-file upload size
        if (resourceCode === FeatureCode.MAX_UPLOAD_BYTES) {
            const fileSize = input.fileSize ?? requestedAmount;
            const allowed = fileSize <= effectiveLimit;
            return {
                allowed,
                resourceCode,
                currentUsage: fileSize,
                limit: effectiveLimit,
                requestedAmount: fileSize,
                remaining: Math.max(0, effectiveLimit - fileSize),
                reason: allowed ? EntitlementDecisionReason.ALLOWED : EntitlementDecisionReason.LIMIT_REACHED,
                message: allowed
                    ? undefined
                    : SubscriptionEntitlementMessages.FILE_SIZE_EXCEEDED(effectiveLimit),
            };
        }

        // Folder count per workspace
        if (resourceCode === FeatureCode.MAX_FOLDERS_PER_WORKSPACE) {
            if (!workspaceObjectId) {
                return {
                    allowed: false,
                    resourceCode,
                    currentUsage: 0,
                    limit: effectiveLimit,
                    requestedAmount,
                    remaining: 0,
                    reason: EntitlementDecisionReason.CONFIGURATION_ERROR,
                    message: SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
                };
            }

            const folderUsage = await this.subscriptionUsageService.getWorkspaceFolderUsage(
                workspaceObjectId.toString(),
                actorId,
            );
            const pending = await this.repository.getPendingReservationAmount(
                scope.type,
                new Types.ObjectId(scope.id),
                resourceCode,
                workspaceObjectId,
            );
            const currentUsage = folderUsage.foldersUsed + pending;
            const allowed = currentUsage + requestedAmount <= effectiveLimit;

            return {
                allowed,
                resourceCode,
                currentUsage,
                limit: effectiveLimit,
                requestedAmount,
                remaining: Math.max(0, effectiveLimit - currentUsage),
                reason: allowed ? EntitlementDecisionReason.ALLOWED : EntitlementDecisionReason.LIMIT_REACHED,
                message: allowed
                    ? undefined
                    : SubscriptionEntitlementMessages.FOLDER_LIMIT_EXCEEDED(effectiveLimit),
            };
        }

        // Global user resources (workspaces, active sticky notes, storage bytes)
        const usage = await this.subscriptionUsageService.getUsageSummary(scope, { fresh: true });
        const pending = await this.repository.getPendingReservationAmount(
            scope.type,
            new Types.ObjectId(scope.id),
            resourceCode,
        );

        let currentUsage = 0;
        if (resourceCode === FeatureCode.MAX_WORKSPACES) {
            currentUsage = usage.workspacesUsed + pending;
        } else if (resourceCode === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
            currentUsage = usage.activeStickyNotesUsed + pending;
        } else if (resourceCode === FeatureCode.MAX_STORAGE_BYTES) {
            currentUsage = usage.storageBytesUsed + pending;
        } else if (resourceCode === FeatureCode.MAX_USERS) {
            currentUsage = usage.usersUsed + pending;
        }

        const allowed = currentUsage + requestedAmount <= effectiveLimit;

        return {
            allowed,
            resourceCode,
            currentUsage,
            limit: effectiveLimit,
            requestedAmount,
            remaining: Math.max(0, effectiveLimit - currentUsage),
            reason: allowed ? EntitlementDecisionReason.ALLOWED : EntitlementDecisionReason.LIMIT_REACHED,
            message: allowed
                ? undefined
                : SubscriptionEntitlementMessages.LIMIT_EXCEEDED(resourceCode, effectiveLimit),
        };
    }

    /**
     * Atomically reserves resource quota for an operation to prevent race conditions.
     */
    async reserveCapacity(
        scope: IBillingScope,
        resource: FeatureCode,
        amount: number,
        options?: {
            workspaceId?: Types.ObjectId | null;
            operationId?: string;
            session?: ClientSession;
            metadata?: Record<string, unknown>;
        },
    ): Promise<IReservationResult> {
        scope = { ...scope, id: this.validateScope(scope).toHexString() };
        if (
            !SUBSCRIPTION_ENTITLEMENT_CONSTANTS.QUOTA_RESOURCES.includes(resource) ||
            resource === FeatureCode.MAX_UPLOAD_BYTES
        ) {
            throw new AppError(
                SubscriptionEntitlementMessages.INVALID_RESOURCE,
                400,
                EntitlementErrorCode.INVALID_RESOURCE,
            );
        }
        const workspaceKey =
            resource === FeatureCode.MAX_FOLDERS_PER_WORKSPACE ? String(options?.workspaceId ?? "") : "";
        return this.repository.withQuotaLock(
            `${scope.type}:${scope.id}:${resource}:${workspaceKey}`,
            (assertLease) => this.reserveCapacityUnderLock(scope, resource, amount, options, assertLease),
        );
    }

    private async reserveCapacityUnderLock(
        scope: IBillingScope,
        resource: FeatureCode,
        amount: number,
        options?: {
            workspaceId?: Types.ObjectId | null;
            operationId?: string;
            session?: ClientSession;
            metadata?: Record<string, unknown>;
        },
        assertLease?: () => Promise<void>,
    ): Promise<IReservationResult> {
        const scopeObjectId = this.validateScope(scope);

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_QUANTITY, 400);
        }

        // Resolve once per admission, inside the lock. Never cache across requests.
        const { limits } = await this.resolveEffectivePlanLimits(scope, options?.session);
        const capability = RESOURCE_CAPABILITIES[resource];
        if (capability) await this.assertFeatureEnabled(scope, capability, options?.session, limits);
        if (resource === FeatureCode.MAX_FOLDERS_PER_WORKSPACE && !options?.workspaceId) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID, 400);
        }

        // Idempotency: if operationId provided and already exists, reuse it
        if (options?.operationId) {
            const existing = await this.repository.findReservationByOperationId(
                options.operationId,
                options.session,
            );
            if (
                existing &&
                (existing.scopeType !== scope.type ||
                    String(existing.scopeId) !== scope.id ||
                    existing.resource !== resource ||
                    existing.amount !== amount ||
                    String(existing.workspaceId ?? "") !== String(options.workspaceId ?? "") ||
                    existing.status !== ReservationStatus.PENDING ||
                    existing.expiresAt <= new Date())
            ) {
                throw new AppError(
                    "This quota operation has already completed or belongs to another request.",
                    409,
                    "SUBSCRIPTION_OPERATION_CONFLICT",
                );
            }
            if (existing) {
                return {
                    reservationId: existing._id.toString(),
                    operationId: existing.operationId,
                    resource: existing.resource,
                    amount: existing.amount,
                    expiresAt: existing.expiresAt,
                };
            }
        }

        // 1. Resolve effective limit from PlanFeature
        const limitConfig = await this.getResourceLimit(scope, resource, options?.session, limits);
        const effectiveLimit = this.effectiveLimit(limitConfig);

        // 2. Query committed usage + pending reservations
        let currentCommitted = 0;
        if (resource === FeatureCode.MAX_FOLDERS_PER_WORKSPACE && options?.workspaceId) {
            const folderCount = await this.subscriptionUsageService.getWorkspaceFolderUsage(
                options.workspaceId.toString(),
                scope.id,
            );
            currentCommitted = folderCount.foldersUsed;
        } else {
            const usage = await this.subscriptionUsageService.getUsageSummary(scope, { fresh: true });
            if (resource === FeatureCode.MAX_WORKSPACES) {
                currentCommitted = usage.workspacesUsed;
            } else if (resource === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
                currentCommitted = usage.activeStickyNotesUsed;
            } else if (resource === FeatureCode.MAX_STORAGE_BYTES) {
                currentCommitted = usage.storageBytesUsed;
            } else if (resource === FeatureCode.MAX_USERS) {
                currentCommitted = usage.usersUsed;
            }
        }

        const pendingReserved = await this.repository.getPendingReservationAmount(
            scope.type,
            scopeObjectId,
            resource,
            options?.workspaceId ?? null,
            options?.session,
        );

        const totalUsed = currentCommitted + pendingReserved;

        // 3. Fast-path quota check
        if (totalUsed + amount > effectiveLimit) {
            throw new AppError(
                this.getLimitExceededMessage(resource, effectiveLimit),
                403,
                EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
            );
        }

        // 4. Create pending reservation with TTL
        const expiresAt = new Date(
            Date.now() + SUBSCRIPTION_ENTITLEMENT_CONSTANTS.DEFAULT_RESERVATION_TTL_SECONDS * 1000,
        );
        const reservationPayload: Partial<ISubscriptionReservation> = {
            scopeType: scope.type,
            scopeId: scopeObjectId,
            workspaceId: options?.workspaceId ?? null,
            resource,
            amount,
            status: ReservationStatus.PENDING,
            expiresAt,
            metadata: options?.metadata ?? {},
        };
        if (options?.operationId?.trim()) {
            reservationPayload.operationId = options.operationId.trim();
        }

        await assertLease?.();
        const reservation = await this.repository.createReservation(reservationPayload, options?.session);

        try {
            // Read ALL pending reservations before fresh persisted usage. ObjectId order is
            // not insertion order across servers. Reading usage first can lose an operation
            // that commits between the two reads.
            const pendingAtAdmission = await this.repository.getPendingReservationAmount(
                scope.type,
                scopeObjectId,
                resource,
                options?.workspaceId ?? null,
                options?.session,
            );
            let committedAtAdmission: number;
            if (resource === FeatureCode.MAX_FOLDERS_PER_WORKSPACE) {
                committedAtAdmission = (
                    await this.subscriptionUsageService.getWorkspaceFolderUsage(
                        String(options!.workspaceId),
                        scope.id,
                    )
                ).foldersUsed;
            } else {
                const usage = await this.subscriptionUsageService.getUsageSummary(scope, { fresh: true });
                committedAtAdmission =
                    resource === FeatureCode.MAX_WORKSPACES
                        ? usage.workspacesUsed
                        : resource === FeatureCode.MAX_ACTIVE_STICKY_NOTES
                          ? usage.activeStickyNotesUsed
                          : resource === FeatureCode.MAX_STORAGE_BYTES
                            ? usage.storageBytesUsed
                            : usage.usersUsed;
            }

            if (committedAtAdmission + pendingAtAdmission > effectiveLimit) {
                throw new AppError(
                    this.getLimitExceededMessage(resource, effectiveLimit),
                    403,
                    EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
                );
            }

            await assertLease?.();
            return {
                reservationId: reservation._id.toString(),
                operationId: reservation.operationId,
                resource: reservation.resource,
                amount: reservation.amount,
                expiresAt: reservation.expiresAt,
            };
        } catch (error) {
            await this.repository.releaseReservation(reservation._id, options?.session);
            throw error;
        }
    }

    private getLimitExceededMessage(resource: string, limit: number): string {
        if (resource === FeatureCode.MAX_WORKSPACES) {
            return SubscriptionEntitlementMessages.WORKSPACE_LIMIT_EXCEEDED(limit);
        }
        if (resource === FeatureCode.MAX_FOLDERS_PER_WORKSPACE) {
            return SubscriptionEntitlementMessages.FOLDER_LIMIT_EXCEEDED(limit);
        }
        if (resource === FeatureCode.MAX_ACTIVE_STICKY_NOTES) {
            return SubscriptionEntitlementMessages.NOTE_LIMIT_EXCEEDED(limit);
        }
        if (resource === FeatureCode.MAX_STORAGE_BYTES) {
            return SubscriptionEntitlementMessages.STORAGE_EXCEEDED(limit);
        }
        return SubscriptionEntitlementMessages.LIMIT_EXCEEDED(resource, limit);
    }

    /**
     * Commits a previously created reservation after successful resource mutation.
     */
    async commitReservation(reservationId: string | Types.ObjectId, session?: ClientSession): Promise<void> {
        const committed = await this.repository.commitReservation(reservationId, session);
        if (committed) {
            const scope: IBillingScope = {
                type: committed.scopeType as BillingScopeType,
                id: committed.scopeId.toString(),
            };
            await this.subscriptionUsageService.recalculateUsage(scope, session).catch(() => {});
        }
    }

    /**
     * Releases a pending reservation when a resource mutation fails.
     */
    async releaseReservation(reservationId: string | Types.ObjectId, session?: ClientSession): Promise<void> {
        await this.repository.releaseReservation(reservationId, session);
    }

    // =========================================================================
    // Core Service Assertions for Mutations
    // =========================================================================

    /**
     * Workspace creation assertion: checks MAX_WORKSPACES quota and reserves 1 workspace.
     */
    async assertCanCreateWorkspace(
        actorId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: actorId,
        };
        return this.reserveCapacity(scope, FeatureCode.MAX_WORKSPACES, 1, options);
    }

    /**
     * Workspace restoration assertion: checks MAX_WORKSPACES quota and reserves 1 workspace.
     */
    async assertCanRestoreWorkspace(
        actorId: string,
        workspaceId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const wsId = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );

        const ownerId = await this.repository.findWorkspaceOwner(wsId, options?.session);
        if (!ownerId) {
            throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: ownerId.toString(),
        };

        return this.reserveCapacity(scope, FeatureCode.MAX_WORKSPACES, 1, options);
    }

    async reserveWorkspaceRestoredNotes(workspaceId: string): Promise<IReservationResult | null> {
        const ownerId = await this.repository.findWorkspaceOwner(workspaceId);
        if (!ownerId) throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        const amount = await this.repository.countActiveNotesInWorkspace(workspaceId);
        if (!amount) return null;
        return this.reserveCapacity(
            { type: BillingScopeType.USER, id: String(ownerId) },
            FeatureCode.MAX_ACTIVE_STICKY_NOTES,
            amount,
        );
    }

    /**
     * Folder creation assertion: checks MAX_FOLDERS_PER_WORKSPACE quota for the workspace.
     */
    async assertCanCreateFolder(
        actorId: string,
        workspaceId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const wsId = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );

        const ownerId = await this.repository.findWorkspaceOwner(wsId, options?.session);
        if (!ownerId) {
            throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: ownerId.toString(),
        };

        return this.reserveCapacity(scope, FeatureCode.MAX_FOLDERS_PER_WORKSPACE, 1, {
            ...options,
            workspaceId: wsId,
        });
    }

    /**
     * Folder restoration assertion: checks MAX_FOLDERS_PER_WORKSPACE quota for the workspace.
     */
    async assertCanRestoreFolder(
        actorId: string,
        folderId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const fId = this.assertValidObjectId(folderId, SubscriptionEntitlementMessages.INVALID_FOLDER_ID);

        const info = await this.repository.findFolderWorkspaceAndOwner(fId, options?.session);
        if (!info) {
            throw new AppError(SubscriptionEntitlementMessages.FOLDER_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: info.ownerId.toString(),
        };

        return this.reserveCapacity(scope, FeatureCode.MAX_FOLDERS_PER_WORKSPACE, 1, {
            ...options,
            workspaceId: info.workspaceId,
        });
    }

    /**
     * Sticky note creation assertion: checks MAX_ACTIVE_STICKY_NOTES quota on owning workspace's billing scope.
     */
    async assertCanCreateStickyNote(
        actorId: string,
        workspaceId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const wsId = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );

        const ownerId = await this.repository.findWorkspaceOwner(wsId, options?.session);
        if (!ownerId) {
            throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: ownerId.toString(),
        };

        if (scope.id !== actorId)
            await this.assertFeatureEnabled(scope, FeatureCode.SHARED_NOTES, options?.session);
        return this.reserveCapacity(scope, FeatureCode.MAX_ACTIVE_STICKY_NOTES, 1, options);
    }

    /**
     * Sticky note activation assertion (restoration or unarchiving into ACTIVE).
     */
    async assertCanActivateStickyNote(
        actorId: string,
        noteId: string,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const nId = this.assertValidObjectId(noteId, SubscriptionEntitlementMessages.INVALID_NOTE_ID);

        const info = await this.repository.findNoteWorkspaceAndOwner(nId, options?.session);
        if (!info) {
            throw new AppError(SubscriptionEntitlementMessages.NOTE_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: info.ownerId.toString(),
        };

        if (scope.id !== actorId)
            await this.assertFeatureEnabled(scope, FeatureCode.SHARED_NOTES, options?.session);
        return this.reserveCapacity(scope, FeatureCode.MAX_ACTIVE_STICKY_NOTES, 1, options);
    }

    /**
     * Attachment upload assertion: enforces both MAX_UPLOAD_BYTES and MAX_STORAGE_BYTES.
     */
    async resolveAttachmentBillingScope(
        actorId: string,
        resourceType: string | null,
        resourceId: string | Types.ObjectId | null,
        session?: ClientSession,
    ): Promise<IBillingScope> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        if (
            (resourceType === MediaResourceType.NOTE || resourceType === MediaResourceType.WORKSPACE) &&
            !resourceId
        ) {
            throw new AppError("An attachment resource ID is required.", 400);
        }
        // 1. Resolve billing scope:
        let scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: actorId,
        };

        if (resourceType === MediaResourceType.NOTE && resourceId) {
            const nId = this.assertValidObjectId(
                String(resourceId),
                SubscriptionEntitlementMessages.INVALID_NOTE_ID,
            );
            const info = await this.repository.findNoteWorkspaceAndOwner(nId, session);
            if (!info) throw new AppError(SubscriptionEntitlementMessages.NOTE_NOT_FOUND, 404);
            if (info) {
                scope = { type: BillingScopeType.USER, id: info.ownerId.toString() };
            }
        } else if (resourceType === MediaResourceType.WORKSPACE && resourceId) {
            const wsId = this.assertValidObjectId(
                String(resourceId),
                SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
            );
            const ownerId = await this.repository.findWorkspaceOwner(wsId, session);
            if (!ownerId) throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
            if (ownerId) {
                scope = { type: BillingScopeType.USER, id: ownerId.toString() };
            }
        }

        return scope;
    }

    async assertCanUploadAttachment(
        actorId: string,
        resourceType: string | null,
        resourceId: string | Types.ObjectId | null,
        fileSize: number,
        options?: { operationId?: string; session?: ClientSession },
    ): Promise<IReservationResult> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);

        if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
            throw new AppError(SubscriptionEntitlementMessages.INVALID_QUANTITY, 400);
        }

        const scope = await this.resolveAttachmentBillingScope(
            actorId,
            resourceType,
            resourceId,
            options?.session,
        );

        // 2. Validate single file upload size (MAX_UPLOAD_BYTES)
        const uploadLimit = await this.getResourceLimit(
            scope,
            FeatureCode.MAX_UPLOAD_BYTES,
            options?.session,
        );
        const maxSingleBytes = this.effectiveLimit(uploadLimit);

        if (fileSize > maxSingleBytes) {
            throw new AppError(
                SubscriptionEntitlementMessages.FILE_SIZE_EXCEEDED(maxSingleBytes),
                403,
                EntitlementErrorCode.SUBSCRIPTION_LIMIT_EXCEEDED,
            );
        }

        // 3. Atomically reserve total storage bytes (MAX_STORAGE_BYTES)
        return this.reserveCapacity(scope, FeatureCode.MAX_STORAGE_BYTES, fileSize, options);
    }

    /**
     * Member addition assertion: preserves open sharing on all personal plans.
     * Ready for future organization seat checks when team billing is introduced.
     */
    async assertCanAddMember(actorId: string, workspaceId: string, _session?: ClientSession): Promise<void> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const wsId = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );

        const ownerId = await this.repository.findWorkspaceOwner(wsId);
        if (!ownerId) {
            throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        }

        await this.assertFeatureEnabled(
            { type: BillingScopeType.USER, id: String(ownerId) },
            FeatureCode.MEMBERS,
            _session,
        );
    }

    /**
     * Fetches per-workspace folder entitlement and current usage.
     */
    async getWorkspaceFolderEntitlements(
        actorId: string,
        workspaceId: string,
    ): Promise<{ limit: number; used: number; remaining: number }> {
        this.assertValidObjectId(actorId, SubscriptionEntitlementMessages.INVALID_USER_ID);
        const wsId = this.assertValidObjectId(
            workspaceId,
            SubscriptionEntitlementMessages.INVALID_WORKSPACE_ID,
        );

        const ownerId = await this.repository.findWorkspaceOwner(wsId);
        if (!ownerId) {
            throw new AppError(SubscriptionEntitlementMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: ownerId.toString(),
        };

        const limitConfig = await this.getResourceLimit(scope, FeatureCode.MAX_FOLDERS_PER_WORKSPACE);
        const effectiveLimit = this.effectiveLimit(limitConfig);

        const folderUsage = await this.subscriptionUsageService.getWorkspaceFolderUsage(workspaceId, actorId);
        const pending = await this.repository.getPendingReservationAmount(
            scope.type,
            ownerId,
            FeatureCode.MAX_FOLDERS_PER_WORKSPACE,
            wsId,
        );

        const totalUsed = folderUsage.foldersUsed + pending;

        return {
            limit: effectiveLimit,
            used: totalUsed,
            remaining: Math.max(0, effectiveLimit - totalUsed),
        };
    }
}

export const subscriptionEntitlementService = new SubscriptionEntitlementService();
