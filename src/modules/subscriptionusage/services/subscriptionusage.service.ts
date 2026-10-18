import { Types, type ClientSession } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { SubscriptionUsageRepository } from "../repositories/subscriptionusage.repository.js";
import { permissionAuthorizationService, type IWorkspaceAuthorizationContext } from "../../permissions/services/permissionAuthorization.service.js";
import { BillingScopeType, SubscriptionResource } from "../constants/subscriptionusage.enums.js";
import { SUBSCRIPTION_USAGE_CONSTANTS } from "../constants/subscriptionusage.constants.js";
import { SubscriptionUsageMessages } from "../constants/subscriptionusage.messages.js";
import type {
    IBillingScope,
    ISubscriptionUsageFilter,
    ISubscriptionUsageSummary,
    IWorkspaceFolderUsage,
    IWorkspaceScopedUsage,
    IReconciliationScopeReport,
    ISubscriptionUsageReconcileReport,
    IUsageReservation,
} from "../interfaces/subscriptionusage.interface.js";

export class SubscriptionUsageService {
    constructor(
        private readonly repository = new SubscriptionUsageRepository(),
    ) {}

    private validateScope(scope: IBillingScope): Types.ObjectId {
        if (!scope || !scope.type || !Object.values(BillingScopeType).includes(scope.type)) {
            throw new AppError(SubscriptionUsageMessages.INVALID_SCOPE, 400);
        }
        if (!scope.id || !Types.ObjectId.isValid(scope.id)) {
            throw new AppError(SubscriptionUsageMessages.INVALID_USER_ID, 400);
        }
        return new Types.ObjectId(scope.id);
    }

    async getMyUsage(
        userId: string,
        options?: { fresh?: boolean; includeFolders?: boolean },
    ): Promise<ISubscriptionUsageSummary> {
        if (!Types.ObjectId.isValid(userId)) {
            throw new AppError(SubscriptionUsageMessages.INVALID_USER_ID, 400);
        }
        const scope: IBillingScope = {
            type: BillingScopeType.USER,
            id: userId,
        };
        return this.getUsageSummary(scope, options);
    }

    async getUsageByScope(
        scope: IBillingScope,
        options?: { fresh?: boolean; includeFolders?: boolean },
    ): Promise<ISubscriptionUsageSummary> {
        return this.getUsageSummary(scope, options);
    }

    async getUsageSummary(
        scope: IBillingScope,
        options?: { fresh?: boolean; includeFolders?: boolean },
    ): Promise<ISubscriptionUsageSummary> {
        const scopeObjectId = this.validateScope(scope);

        if (!options?.fresh) {
            const cached = await this.repository.findByScope(scope.type, scopeObjectId);
            if (cached) {
                let workspaceFolders: IWorkspaceFolderUsage[] | undefined;
                if (options?.includeFolders) {
                    const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId);
                    const folderMap = await this.repository.aggregateFoldersByWorkspaceIds(ownedWorkspaceIds);
                    workspaceFolders = ownedWorkspaceIds.map(wId => ({
                        workspaceId: String(wId),
                        foldersUsed: folderMap.get(String(wId)) ?? 0,
                    }));
                }

                return {
                    scopeType: cached.scopeType,
                    scopeId: String(cached.scopeId),
                    workspacesUsed: cached.workspacesUsed,
                    activeStickyNotesUsed: cached.activeStickyNotesUsed,
                    storageBytesUsed: cached.storageBytesUsed,
                    usersUsed: cached.usersUsed,
                    workspaceFolders,
                    calculatedAt: cached.lastCalculatedAt,
                    cached: true,
                };
            }
        }

        const calculated = await this.recalculateUsage(scope);
        if (options?.includeFolders) {
            const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId);
            const folderMap = await this.repository.aggregateFoldersByWorkspaceIds(ownedWorkspaceIds);
            calculated.workspaceFolders = ownedWorkspaceIds.map(wId => ({
                workspaceId: String(wId),
                foldersUsed: folderMap.get(String(wId)) ?? 0,
            }));
        }

        return calculated;
    }

    async getWorkspaceFolderUsage(
        workspaceId: string,
        actorId: string,
        authorization?: IWorkspaceAuthorizationContext,
    ): Promise<IWorkspaceScopedUsage> {
        if (!Types.ObjectId.isValid(workspaceId)) {
            throw new AppError(SubscriptionUsageMessages.INVALID_WORKSPACE_ID, 400);
        }
        if (!Types.ObjectId.isValid(actorId)) {
            throw new AppError(SubscriptionUsageMessages.UNAUTHORIZED, 401);
        }

        const auth = authorization?.workspaceStatus !== undefined && authorization.workspaceId === workspaceId
            ? authorization
            : await permissionAuthorizationService.resolveWorkspaceAuthorization(actorId, workspaceId);

        permissionAuthorizationService.assertWorkspaceState(auth.workspaceStatus!);

        const workspaceObjectId = new Types.ObjectId(workspaceId);
        const workspace = await this.repository.findWorkspaceById(workspaceObjectId);
        if (!workspace) {
            throw new AppError(SubscriptionUsageMessages.WORKSPACE_NOT_FOUND, 404);
        }

        const [foldersUsed, activeStickyNotesUsed, storageBytesUsed] = await Promise.all([
            this.repository.countFoldersInWorkspace(workspaceObjectId),
            this.repository.countActiveStickyNotesInWorkspace(workspaceObjectId),
            this.repository.aggregateWorkspaceStorageBytes(workspaceObjectId),
        ]);

        return {
            workspaceId: String(workspace._id),
            workspaceName: workspace.name,
            ownerId: String(workspace.ownerId),
            isOwner: String(workspace.ownerId) === actorId,
            foldersUsed,
            activeStickyNotesUsed,
            storageBytesUsed,
            calculatedAt: new Date(),
        };
    }

    async getActiveStickyNoteUsage(scope: IBillingScope): Promise<number> {
        const scopeObjectId = this.validateScope(scope);
        const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId);
        return this.repository.countActiveStickyNotes(ownedWorkspaceIds);
    }

    async getAttachmentStorageUsage(scope: IBillingScope): Promise<number> {
        const scopeObjectId = this.validateScope(scope);
        const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId);
        return this.repository.aggregateStorageBytes(scopeObjectId, ownedWorkspaceIds);
    }

    async recalculateUsage(
        scope: IBillingScope,
        session?: ClientSession,
    ): Promise<ISubscriptionUsageSummary> {
        const scopeObjectId = this.validateScope(scope);

        const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId, session);
        const workspacesUsed = ownedWorkspaceIds.length;

        const [activeStickyNotesUsed, storageBytesUsed] = await Promise.all([
            this.repository.countActiveStickyNotes(ownedWorkspaceIds, session),
            this.repository.aggregateStorageBytes(scopeObjectId, ownedWorkspaceIds, session),
        ]);

        const usersUsed = SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_USERS_COUNT;
        const lastCalculatedAt = new Date();

        const { usage } = await this.repository.upsertUsage(
            scope.type,
            scopeObjectId,
            {
                workspacesUsed,
                activeStickyNotesUsed,
                storageBytesUsed,
                usersUsed,
                lastCalculatedAt,
            },
            undefined,
            session,
        );

        return {
            scopeType: usage.scopeType,
            scopeId: String(usage.scopeId),
            workspacesUsed: usage.workspacesUsed,
            activeStickyNotesUsed: usage.activeStickyNotesUsed,
            storageBytesUsed: usage.storageBytesUsed,
            usersUsed: usage.usersUsed,
            calculatedAt: usage.lastCalculatedAt,
            cached: false,
        };
    }

    async reconcileUsage(
        scope: IBillingScope,
        _reason?: string,
    ): Promise<IReconciliationScopeReport> {
        const scopeObjectId = this.validateScope(scope);

        const cached = await this.repository.findByScope(scope.type, scopeObjectId);
        const cachedData = {
            workspacesUsed: cached?.workspacesUsed ?? 0,
            activeStickyNotesUsed: cached?.activeStickyNotesUsed ?? 0,
            storageBytesUsed: cached?.storageBytesUsed ?? 0,
            usersUsed: cached?.usersUsed ?? 0,
        };

        const ownedWorkspaceIds = await this.repository.findOwnedWorkspaceIds(scopeObjectId);
        const actualWorkspaces = ownedWorkspaceIds.length;
        const [actualNotes, actualStorage] = await Promise.all([
            this.repository.countActiveStickyNotes(ownedWorkspaceIds),
            this.repository.aggregateStorageBytes(scopeObjectId, ownedWorkspaceIds),
        ]);
        const actualUsers = SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_USERS_COUNT;

        const actualData = {
            workspacesUsed: actualWorkspaces,
            activeStickyNotesUsed: actualNotes,
            storageBytesUsed: actualStorage,
            usersUsed: actualUsers,
        };

        const discrepancy = {
            workspacesDiff: actualData.workspacesUsed - cachedData.workspacesUsed,
            activeStickyNotesDiff: actualData.activeStickyNotesUsed - cachedData.activeStickyNotesUsed,
            storageBytesDiff: actualData.storageBytesUsed - cachedData.storageBytesUsed,
            usersDiff: actualData.usersUsed - cachedData.usersUsed,
        };

        const hasDrift =
            !cached ||
            discrepancy.workspacesDiff !== 0 ||
            discrepancy.activeStickyNotesDiff !== 0 ||
            discrepancy.storageBytesDiff !== 0 ||
            discrepancy.usersDiff !== 0;

        let repaired = false;
        if (hasDrift) {
            const { conflict } = await this.repository.upsertUsage(
                scope.type,
                scopeObjectId,
                {
                    ...actualData,
                    lastCalculatedAt: new Date(),
                },
                cached?.revision,
            );
            repaired = !conflict;
        }

        return {
            scopeType: scope.type,
            scopeId: String(scopeObjectId),
            status: hasDrift ? (repaired ? "REPAIRED" : "ERROR") : "MATCHED",
            cached: cachedData,
            actual: actualData,
            discrepancy,
            repaired,
        };
    }

    async reconcileAll(options?: {
        batchSize?: number;
        dryRun?: boolean;
        reason?: string;
    }): Promise<ISubscriptionUsageReconcileReport> {
        const batchSize = Math.min(
            SUBSCRIPTION_USAGE_CONSTANTS.RECONCILIATION_BATCH_MAX,
            Math.max(1, options?.batchSize ?? SUBSCRIPTION_USAGE_CONSTANTS.RECONCILIATION_BATCH_DEFAULT),
        );

        const scopeIds = await this.repository.findDistinctScopeIds(batchSize, 0);
        const scopes: IReconciliationScopeReport[] = [];
        let matchedCount = 0;
        let repairedCount = 0;
        let errorCount = 0;

        for (const scopeId of scopeIds) {
            try {
                const scope: IBillingScope = {
                    type: BillingScopeType.USER,
                    id: scopeId,
                };
                const report = await this.reconcileUsage(scope, options?.reason);
                scopes.push(report);
                if (report.status === "MATCHED") matchedCount++;
                else if (report.status === "REPAIRED") repairedCount++;
                else errorCount++;
            } catch (err: any) {
                errorCount++;
                scopes.push({
                    scopeType: BillingScopeType.USER,
                    scopeId,
                    status: "ERROR",
                    cached: { workspacesUsed: 0, activeStickyNotesUsed: 0, storageBytesUsed: 0, usersUsed: 0 },
                    actual: { workspacesUsed: 0, activeStickyNotesUsed: 0, storageBytesUsed: 0, usersUsed: 0 },
                    discrepancy: { workspacesDiff: 0, activeStickyNotesDiff: 0, storageBytesDiff: 0, usersDiff: 0 },
                    repaired: false,
                    error: err?.message ?? "Reconciliation failed",
                });
            }
        }

        return {
            totalProcessed: scopes.length,
            matchedCount,
            repairedCount,
            errorCount,
            dryRun: Boolean(options?.dryRun),
            scopes,
            executedAt: new Date(),
        };
    }

    async getAdminUsageList(
        _actorId: string,
        filter: ISubscriptionUsageFilter,
    ) {
        const { data, total } = await this.repository.findAll(filter);
        const page = Math.max(1, filter.page ?? SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_PAGE);
        const limit = Math.min(
            SUBSCRIPTION_USAGE_CONSTANTS.MAX_LIMIT,
            Math.max(1, filter.limit ?? SUBSCRIPTION_USAGE_CONSTANTS.DEFAULT_LIMIT),
        );

        return {
            data: data.map(item => ({
                id: String(item._id),
                scopeType: item.scopeType,
                scopeId: String(item.scopeId),
                workspacesUsed: item.workspacesUsed,
                activeStickyNotesUsed: item.activeStickyNotesUsed,
                storageBytesUsed: item.storageBytesUsed,
                usersUsed: item.usersUsed,
                lastCalculatedAt: item.lastCalculatedAt,
                updatedAt: item.updatedAt,
                createdAt: item.createdAt,
            })),
            pagination: {
                page,
                limit,
                total,
            },
        };
    }

    // Future entitlement reservation interface
    async reserveUsage(reservation: IUsageReservation): Promise<{ reserved: boolean; reservationId?: string }> {
        this.validateScope(reservation.scope);
        if (reservation.amount <= 0) {
            throw new AppError("Reservation amount must be positive.", 400);
        }
        return {
            reserved: true,
            reservationId: new Types.ObjectId().toString(),
        };
    }

    async commitUsage(_reservationId: string): Promise<boolean> {
        return true;
    }

    async releaseUsage(_reservationId: string): Promise<boolean> {
        return true;
    }
}
