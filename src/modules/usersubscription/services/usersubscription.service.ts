import { Types } from "mongoose";
import { AppError } from "../../../utils/errors/app.error.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";
import { PlanRepository } from "../../plan/repositories/plan.repository.js";
import { PlanCode, PlanPricingModel, PlanType, PlanVisibility } from "../../plan/constants/plan.enums.js";
import { PlanPriceRepository } from "../../planprice/repositories/planPrice.repository.js";
import { UserStatus } from "../../user/constants/user.enums.js";
import { AuditLogService } from "../../auditlog/services/auditLog.service.js";
import { AuditLogAction, AuditLogActorType } from "../../auditlog/constants/auditLog.enums.js";
import type { IAuditLogContext } from "../../auditlog/interfaces/auditLog.interface.js";
import { permissionAuthorizationService } from "../../permissions/services/permissionAuthorization.service.js";
import {
    PermissionAccess,
    PermissionAction,
    PermissionModule,
} from "../../permissions/constants/permission.enums.js";
import { UserSubscriptionRepository } from "../repositories/usersubscription.repository.js";
import { UserSubscriptionMessages } from "../constants/usersubscription.messages.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";
import {
    SubscriptionAccessState,
    SubscriptionChangeStatus,
    UserSubscriptionStatus,
} from "../constants/usersubscription.enums.js";
import { UserSubscriptionValidation } from "../validations/usersubscription.validation.js";
import {
    adminSubscriptionsSchema,
    cancelSubscriptionSchema,
    changeSubscriptionPlanSchema,
    reconcileSubscriptionsSchema,
    subscriptionObjectIdSchema,
    userSubscriptionsSchema,
} from "../validations/usersubscription.schema.js";
import type {
    IUserSubscription,
    ISubscriptionAuditEvent,
    ISubscriptionReconciliationResult,
    UserSubscriptionRecord,
    UserSubscriptionUpdate,
    IVerifiedBillingEvent,
} from "../interfaces/usersubscription.interface.js";

export class UserSubscriptionService {
    private readonly subscriptionRepository: UserSubscriptionRepository;
    private readonly planRepository: PlanRepository;
    private readonly planPriceRepository: PlanPriceRepository;
    private readonly auditLogService: AuditLogService;

    constructor() {
        this.subscriptionRepository = new UserSubscriptionRepository();
        this.planRepository = new PlanRepository();
        this.planPriceRepository = new PlanPriceRepository();
        this.auditLogService = new AuditLogService();
    }

    // Internal registration provisioning. PENDING accounts may be provisioned, but cannot mutate through user APIs.
    async ensureFreeSubscription(userId: string, context?: IAuditLogContext) {
        await this.assertAccount(userId, false, true);
        const existing = await this.subscriptionRepository.findCurrentByUser(userId);
        if (existing) return this.toResponse(existing);

        const free = await this.getFreePlan();
        const now = new Date();
        const data: Partial<IUserSubscription> = {
            user: new Types.ObjectId(userId),
            plan: free._id,
            planPriceId: null,
            billingInterval: null,
            status: UserSubscriptionStatus.ACTIVE,
            startDate: now,
            endDate: null,
            currentPeriodStart: now,
            currentPeriodEnd: null,
            autoRenew: false,
            cancelAtPeriodEnd: false,
            isActive: true,
            revision: 0,
        };
        const event = this.auditEvent(
            userId,
            AuditLogAction.CREATE,
            UserSubscriptionMessages.FREE_READY,
            null,
            data,
            now,
            context,
        );
        try {
            const subscription = await this.subscriptionRepository.create({ ...data, auditOutbox: [event] });
            await this.deliverAudit(subscription._id, [event]);
            return this.toResponse(subscription);
        } catch (error) {
            if (this.isDuplicateKey(error)) {
                const winner = await this.subscriptionRepository.findCurrentByUser(userId);
                if (winner) return this.toResponse(winner);
                throw new AppError(UserSubscriptionMessages.CONFLICT, 409);
            }
            throw error;
        }
    }

    async getCurrentSubscription(actorId: string) {
        await this.assertAccount(actorId);
        const current = await this.subscriptionRepository.findCurrentByUser(actorId);
        const now = new Date();
        const selectedPlan = current
            ? await this.planRepository.findSubscriptionPlan(current.plan.toString())
            : null;
        const nonExpiringFree = selectedPlan?.code === PlanCode.FREE && selectedPlan.type === PlanType.FREE;
        const valid =
            current &&
            selectedPlan &&
            this.hasValidPeriod(current, now) &&
            (nonExpiringFree || Boolean(current.currentPeriodEnd ?? current.endDate));
        const effectivePlan = valid ? selectedPlan : await this.getFreePlan();
        return {
            subscription: current ? this.toResponse(current) : null,
            effectivePlan,
            accessState: valid
                ? SubscriptionAccessState.CURRENT
                : current
                  ? SubscriptionAccessState.AWAITING_RECONCILIATION
                  : SubscriptionAccessState.FREE_FALLBACK,
        };
    }

    async getSubscriptionStatus(actorId: string) {
        const current = await this.getCurrentSubscription(actorId);
        return {
            status: current.subscription?.status ?? null,
            accessState: current.accessState,
            effectivePlan: current.effectivePlan,
            currentPeriodEnd: current.subscription?.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: current.subscription?.cancelAtPeriodEnd ?? false,
        };
    }

    async getSubscriptionById(id: string, actorId: string) {
        await this.assertAccount(actorId);
        this.assertId(id);
        const subscription = await this.subscriptionRepository.findByIdForUser(id, actorId);
        if (!subscription) throw new AppError(UserSubscriptionMessages.NOT_FOUND, 404);
        return this.toResponse(subscription);
    }

    async getUserSubscriptions(actorId: string, input: unknown = {}) {
        await this.assertAccount(actorId);
        const filters = this.parse(userSubscriptionsSchema, input);
        const result = await this.subscriptionRepository.list(filters, actorId);
        return { ...result, data: result.data.map((row) => this.toResponse(row)) };
    }

    async getSubscriptionHistory(actorId: string, input: unknown = {}) {
        return this.getUserSubscriptions(actorId, input);
    }

    async getAdminSubscriptions(actorId: string, input: unknown = {}) {
        await this.assertAdmin(actorId, PermissionAction.READ);
        const filters = this.parse(adminSubscriptionsSchema, input);
        const result = await this.subscriptionRepository.list(filters);
        return { ...result, data: result.data.map((row) => this.toResponse(row)) };
    }

    async getAdminSubscriptionById(id: string, actorId: string) {
        await this.assertAdmin(actorId, PermissionAction.READ);
        this.assertId(id);
        const subscription = await this.subscriptionRepository.findByIdForAdmin(id);
        if (!subscription) throw new AppError(UserSubscriptionMessages.NOT_FOUND, 404);
        return this.toResponse(subscription);
    }

    async requestPlanChange(actorId: string, input: unknown, context?: IAuditLogContext) {
        await this.assertAccount(actorId, true);
        const data = this.parse(changeSubscriptionPlanSchema, input);
        const selectedPlan = await this.planRepository.findSubscriptionPlan(data.plan);
        if (
            !selectedPlan ||
            !selectedPlan.isActive ||
            selectedPlan.visibility !== PlanVisibility.PUBLIC ||
            [PlanCode.TEAM, PlanCode.ENTERPRISE].includes(selectedPlan.code) ||
            selectedPlan.type === PlanType.CUSTOM ||
            selectedPlan.pricingModel !== PlanPricingModel.FIXED
        ) {
            throw new AppError(UserSubscriptionMessages.PLAN_UNAVAILABLE, 422);
        }
        const isFree = selectedPlan.code === PlanCode.FREE && selectedPlan.type === PlanType.FREE;
        if (selectedPlan.type === PlanType.FREE && !isFree) {
            throw new AppError(UserSubscriptionMessages.PLAN_UNAVAILABLE, 422);
        }
        let priceId: Types.ObjectId | null = null;
        if (isFree) {
            if (data.planPriceId || data.billingInterval)
                throw new AppError(UserSubscriptionMessages.FREE_PRICE, 422);
        } else {
            if (!data.planPriceId || !data.billingInterval)
                throw new AppError(UserSubscriptionMessages.PRICE_REQUIRED, 422);
            const price = await this.planPriceRepository.findById(data.planPriceId);
            if (
                !price ||
                !price.isActive ||
                price.planId.toString() !== data.plan ||
                price.billingInterval !== data.billingInterval
            ) {
                throw new AppError(UserSubscriptionMessages.PRICE_MISMATCH, 422);
            }
            priceId = new Types.ObjectId(price._id.toString());
        }

        let current = await this.subscriptionRepository.findCurrentByUser(actorId);
        if (!current) {
            await this.ensureFreeSubscription(actorId, context);
            current = await this.subscriptionRepository.findCurrentByUser(actorId);
        }
        if (!current) throw new AppError(UserSubscriptionMessages.CONFLICT, 409);
        this.assertMutablePeriod(current);
        const sameSelection =
            current.plan.toString() === data.plan &&
            (current.planPriceId?.toString() ?? null) === (priceId?.toString() ?? null);
        if (sameSelection && !current.pendingChange) return this.toResponse(current);
        if (
            current.pendingChange?.planId.toString() === data.plan &&
            (current.pendingChange.planPriceId?.toString() ?? null) === (priceId?.toString() ?? null)
        ) {
            return this.toResponse(current);
        }
        if (current.cancelAtPeriodEnd) throw new AppError(UserSubscriptionMessages.CONFLICT, 409);

        const now = new Date();
        const changes: UserSubscriptionUpdate = {
            pendingChange: sameSelection
                ? null
                : {
                      requestId: new Types.ObjectId(),
                      planId: selectedPlan._id,
                      planPriceId: priceId,
                      billingInterval: data.billingInterval ?? null,
                      status: isFree
                          ? SubscriptionChangeStatus.SCHEDULED
                          : SubscriptionChangeStatus.PENDING_PAYMENT,
                      requestedAt: now,
                      effectiveAt: isFree ? (current.currentPeriodEnd ?? current.endDate) : null,
                  },
        };
        if (isFree && !sameSelection) {
            const end = current.currentPeriodEnd ?? current.endDate;
            if (!end) throw new AppError(UserSubscriptionMessages.INVALID_PERIOD, 409);
            changes.cancelAtPeriodEnd = true;
            changes.cancellationEffectiveAt = end;
            changes.cancellationReason = UserSubscriptionMessages.CHANGE_REQUESTED;
            changes.autoRenewBeforeCancellation = current.autoRenew;
            changes.autoRenew = false;
        }
        return this.commit(
            current,
            changes,
            actorId,
            AuditLogAction.UPDATE,
            UserSubscriptionMessages.CHANGE_REQUESTED,
            context,
        );
    }

    async requestCancellation(actorId: string, input: unknown = {}, context?: IAuditLogContext) {
        await this.assertAccount(actorId, true);
        const { reason } = this.parse(cancelSubscriptionSchema, input);
        const current = await this.requireCurrent(actorId);
        this.assertMutablePeriod(current);
        if (current.cancelAtPeriodEnd) return this.toResponse(current);

        const end = current.currentPeriodEnd ?? current.endDate;
        if (!end) {
            // Free access remains; only an incomplete paid-plan request is abandoned.
            if (!current.pendingChange) return this.toResponse(current);
            return this.commit(
                current,
                { pendingChange: null },
                actorId,
                AuditLogAction.UPDATE,
                reason ?? UserSubscriptionMessages.CANCELLATION_REQUESTED,
                context,
            );
        }
        return this.commit(
            current,
            {
                cancelAtPeriodEnd: true,
                cancellationEffectiveAt: end,
                cancellationReason: reason ?? null,
                autoRenewBeforeCancellation: current.autoRenew,
                autoRenew: false,
                pendingChange: null,
            },
            actorId,
            AuditLogAction.UPDATE,
            reason ?? UserSubscriptionMessages.CANCELLATION_REQUESTED,
            context,
        );
    }

    async undoScheduledCancellation(actorId: string, context?: IAuditLogContext) {
        await this.assertAccount(actorId, true);
        const current = await this.requireCurrent(actorId);
        this.assertMutablePeriod(current);
        if (!current.cancelAtPeriodEnd) return this.toResponse(current);
        if (!current.cancellationEffectiveAt || current.cancellationEffectiveAt <= new Date()) {
            throw new AppError(UserSubscriptionMessages.NO_CANCELLATION, 409);
        }
        return this.commit(
            current,
            {
                cancelAtPeriodEnd: false,
                cancellationEffectiveAt: null,
                cancellationReason: null,
                autoRenew: current.autoRenewBeforeCancellation ?? false,
                autoRenewBeforeCancellation: null,
                pendingChange: null,
            },
            actorId,
            AuditLogAction.UPDATE,
            UserSubscriptionMessages.CANCELLATION_UNDONE,
            context,
        );
    }

    async reconcileAsAdmin(actorId: string, input: unknown, context?: IAuditLogContext) {
        await this.assertAdmin(actorId, PermissionAction.MANAGE);
        const options = this.parse(reconcileSubscriptionsSchema, input);
        return this.reconcileExpiredSubscriptions(
            options.batchSize,
            options.afterId,
            {
                ...context,
                actorId,
            },
            options.reason,
        );
    }

    // Internal worker entry point. Routes use reconcileAsAdmin; no caller can supply payment evidence here.
    async reconcileExpiredSubscriptions(
        batchSize = USER_SUBSCRIPTION_CONSTANTS.RECONCILE_BATCH_SIZE as number,
        afterId?: string,
        context?: IAuditLogContext,
        reason: string = UserSubscriptionMessages.RECONCILED,
    ): Promise<ISubscriptionReconciliationResult> {
        if (
            !Number.isInteger(batchSize) ||
            batchSize < 1 ||
            batchSize > USER_SUBSCRIPTION_CONSTANTS.MAX_BATCH_SIZE
        ) {
            throw new AppError(UserSubscriptionMessages.INVALID_INPUT, 400);
        }
        if (afterId) this.assertId(afterId);
        const now = new Date();
        const rows = await this.subscriptionRepository.findDue(now, batchSize, afterId);
        const result: ISubscriptionReconciliationResult = {
            scanned: rows.length,
            updated: 0,
            conflicts: 0,
            failed: [],
            nextCursor: rows.length === batchSize ? rows.at(-1)!._id.toString() : null,
        };
        for (const row of rows) {
            try {
                const status = UserSubscriptionValidation.reconciliationStatus(row, now);
                if (!status) continue;
                UserSubscriptionValidation.assertTransition(row.status, status);
                const changes: UserSubscriptionUpdate = {
                    status,
                    isActive: false,
                    autoRenew: false,
                    autoRenewBeforeCancellation: null,
                    pendingChange: null,
                    ...(status === UserSubscriptionStatus.CANCELED ? { canceledAt: now } : {}),
                };
                const event = this.auditEvent(
                    context?.actorId?.toString() ?? null,
                    AuditLogAction.STATUS_CHANGE,
                    reason,
                    this.snapshot(row),
                    this.snapshot({ ...row, ...changes }),
                    now,
                    context,
                );
                const updated = await this.subscriptionRepository.compareAndSet(
                    row,
                    changes,
                    event,
                    this.subscriptionRepository.dueFilter(now),
                );
                if (updated) {
                    result.updated++;
                    await this.deliverAudit(updated._id, updated.auditOutbox ?? []);
                } else {
                    result.conflicts++;
                }
            } catch {
                result.failed.push(row._id.toString());
            }
        }
        await this.flushAuditOutbox(batchSize);
        return result;
    }

    async flushAuditOutbox(
        batchSize = USER_SUBSCRIPTION_CONSTANTS.RECONCILE_BATCH_SIZE as number,
    ): Promise<void> {
        const rows = await this.subscriptionRepository.findAuditBacklog(
            Math.min(Math.max(batchSize, 1), USER_SUBSCRIPTION_CONSTANTS.MAX_BATCH_SIZE),
        );
        for (const row of rows) await this.deliverAudit(row._id, row.auditOutbox ?? []);
    }

    // Trusted billing event application. Updates subscription lifecycle state, period bounds, and payment references.
    async applyVerifiedBillingEvent(
        event?: IVerifiedBillingEvent,
        context?: IAuditLogContext,
    ): Promise<UserSubscriptionRecord> {
        if (!event) {
            throw new AppError(UserSubscriptionMessages.BILLING_REQUIRED, 503, "BILLING_NOT_IMPLEMENTED");
        }

        const userId = event.user.toString();
        let current = await this.subscriptionRepository.findCurrentByUser(userId);

        if (!current && event.providerSubscriptionId && event.paymentProvider) {
            current = await this.subscriptionRepository.findByProviderSubscriptionId(
                event.paymentProvider,
                event.providerSubscriptionId,
            );
        }

        const now = new Date();
        const changes: UserSubscriptionUpdate = {
            plan: new Types.ObjectId(event.plan.toString()),
            planPriceId: event.planPriceId ? new Types.ObjectId(event.planPriceId.toString()) : null,
            billingInterval: event.billingInterval ?? null,
            status: event.status,
            isActive: event.isActive ?? true,
            startDate: event.startDate ?? current?.startDate ?? now,
            currentPeriodStart: event.currentPeriodStart ?? current?.currentPeriodStart ?? now,
            currentPeriodEnd:
                event.currentPeriodEnd !== undefined
                    ? event.currentPeriodEnd
                    : (current?.currentPeriodEnd ?? null),
            endDate:
                event.endDate !== undefined
                    ? event.endDate
                    : (event.currentPeriodEnd ?? current?.endDate ?? null),
            autoRenew: event.autoRenew ?? current?.autoRenew ?? true,
            cancelAtPeriodEnd: event.cancelAtPeriodEnd ?? false,
            canceledAt: event.canceledAt ?? (event.status === UserSubscriptionStatus.CANCELED ? now : null),
            cancellationEffectiveAt: event.cancellationEffectiveAt ?? null,
            cancellationReason: event.cancellationReason ?? null,
            pendingChange: event.pendingChange !== undefined ? event.pendingChange : null,
            paymentId: event.paymentId ?? current?.paymentId,
            paymentProvider: event.paymentProvider ?? current?.paymentProvider,
            providerSubscriptionId: event.providerSubscriptionId ?? current?.providerSubscriptionId,
            providerCustomerId: event.providerCustomerId ?? current?.providerCustomerId,
        };

        if (current) {
            const audit = this.auditEvent(
                userId,
                event.action ?? AuditLogAction.UPDATE,
                event.reason ?? "Billing event applied",
                this.snapshot(current),
                this.snapshot({ ...current, ...changes }),
                now,
                context,
            );
            const updated = await this.subscriptionRepository.compareAndSet(current, changes, audit);
            if (!updated) {
                const fresh = await this.subscriptionRepository.findCurrentByUser(userId);
                if (fresh) {
                    const retryAudit = this.auditEvent(
                        userId,
                        event.action ?? AuditLogAction.UPDATE,
                        event.reason ?? "Billing event applied (retry)",
                        this.snapshot(fresh),
                        this.snapshot({ ...fresh, ...changes }),
                        now,
                        context,
                    );
                    const retryUpdated = await this.subscriptionRepository.compareAndSet(
                        fresh,
                        changes,
                        retryAudit,
                    );
                    if (retryUpdated) {
                        await this.deliverAudit(retryUpdated._id, retryUpdated.auditOutbox ?? []);
                        return retryUpdated;
                    }
                }
                throw new AppError(UserSubscriptionMessages.CONFLICT, 409);
            }
            await this.deliverAudit(updated._id, updated.auditOutbox ?? []);
            return updated;
        } else {
            const created = await this.subscriptionRepository.create({
                user: new Types.ObjectId(userId),
                plan: new Types.ObjectId(event.plan.toString()),
                planPriceId: event.planPriceId ? new Types.ObjectId(event.planPriceId.toString()) : null,
                billingInterval: event.billingInterval ?? null,
                status: event.status,
                isActive: true,
                startDate: event.startDate ?? now,
                endDate: event.endDate ?? event.currentPeriodEnd ?? null,
                currentPeriodStart: event.currentPeriodStart ?? now,
                currentPeriodEnd: event.currentPeriodEnd ?? null,
                autoRenew: event.autoRenew ?? true,
                cancelAtPeriodEnd: false,
                paymentId: event.paymentId,
                paymentProvider: event.paymentProvider,
                providerSubscriptionId: event.providerSubscriptionId,
                providerCustomerId: event.providerCustomerId,
                revision: 0,
                auditOutbox: [],
            });
            return created;
        }
    }

    // Compatibility names preserve the old caller surface without restoring unsafe paid activation.
    async createSubscription(actorId: string, plan: string, context?: IAuditLogContext) {
        return this.requestPlanChange(actorId, { plan }, context);
    }

    async getActiveSubscription(actorId: string) {
        return this.getCurrentSubscription(actorId);
    }

    async changePlan(actorId: string, plan: string, context?: IAuditLogContext) {
        return this.requestPlanChange(actorId, { plan }, context);
    }

    async cancelSubscription(actorId: string, context?: IAuditLogContext) {
        return this.requestCancellation(actorId, {}, context);
    }

    private async assertAccount(actorId: string, mutation = false, provisioning = false): Promise<void> {
        if (!subscriptionObjectIdSchema.safeParse(actorId).success)
            throw new AppError(UserSubscriptionMessages.UNAUTHORIZED, 401);
        const account = await this.subscriptionRepository.findAccount(actorId);
        if (!account) throw new AppError(UserSubscriptionMessages.USER_NOT_FOUND, 404);
        if (
            (mutation && account.status !== UserStatus.ACTIVE) ||
            (provisioning && ![UserStatus.ACTIVE, UserStatus.PENDING].includes(account.status))
        ) {
            throw new AppError(UserSubscriptionMessages.INACTIVE_ACCOUNT, 403);
        }
    }

    private async assertAdmin(actorId: string, action: PermissionAction): Promise<void> {
        await this.assertAccount(actorId, true);
        const authorization = await permissionAuthorizationService.resolveGlobalAuthorization(actorId);
        permissionAuthorizationService.assertPermission(
            {
                permissions: authorization.permissions.filter(
                    (permission) => permission.access !== PermissionAccess.OWN,
                ),
            },
            PermissionModule.USER_SUBSCRIPTION,
            action,
        );
    }

    private async getFreePlan() {
        const plan = await this.planRepository.findActiveFreePlan();
        if (!plan) throw new AppError(UserSubscriptionMessages.FREE_UNAVAILABLE, 503);
        return plan;
    }

    private async requireCurrent(actorId: string): Promise<UserSubscriptionRecord> {
        const subscription = await this.subscriptionRepository.findCurrentByUser(actorId);
        if (!subscription) throw new AppError(UserSubscriptionMessages.NOT_FOUND, 404);
        return subscription;
    }

    private assertMutablePeriod(subscription: UserSubscriptionRecord): void {
        UserSubscriptionValidation.assertPeriod({
            ...subscription,
            currentPeriodStart: subscription.currentPeriodStart ?? subscription.startDate,
            currentPeriodEnd: subscription.currentPeriodEnd ?? subscription.endDate,
        });
        if (!this.hasValidPeriod(subscription, new Date()))
            throw new AppError(UserSubscriptionMessages.PERIOD_ENDED, 409);
        if ((subscription.auditOutbox?.length ?? 0) >= USER_SUBSCRIPTION_CONSTANTS.MAX_AUDIT_OUTBOX) {
            throw new AppError(UserSubscriptionMessages.AUDIT_BACKLOG, 503);
        }
    }

    private hasValidPeriod(subscription: UserSubscriptionRecord, now: Date): boolean {
        const end = subscription.currentPeriodEnd ?? subscription.endDate;
        try {
            UserSubscriptionValidation.assertPeriod({
                ...subscription,
                currentPeriodStart: subscription.currentPeriodStart ?? subscription.startDate,
                currentPeriodEnd: subscription.currentPeriodEnd ?? subscription.endDate,
            });
        } catch {
            return false;
        }
        return (
            subscription.isActive &&
            [UserSubscriptionStatus.ACTIVE, UserSubscriptionStatus.PAST_DUE].includes(subscription.status) &&
            subscription.startDate <= now &&
            (!subscription.currentPeriodStart || subscription.currentPeriodStart <= now) &&
            (!end || end > now) &&
            (!subscription.cancelAtPeriodEnd ||
                !subscription.cancellationEffectiveAt ||
                subscription.cancellationEffectiveAt > now)
        );
    }

    private async commit(
        previous: UserSubscriptionRecord,
        changes: UserSubscriptionUpdate,
        actorId: string,
        action: AuditLogAction,
        reason: string,
        context?: IAuditLogContext,
    ) {
        const now = new Date();
        const event = this.auditEvent(
            actorId,
            action,
            reason,
            this.snapshot(previous),
            this.snapshot({ ...previous, ...changes }),
            now,
            context,
        );
        const updated = await this.subscriptionRepository.compareAndSet(previous, changes, event, {
            $and: [
                { $or: [{ currentPeriodEnd: null }, { currentPeriodEnd: { $gt: now } }] },
                { $or: [{ endDate: null }, { endDate: { $gt: now } }] },
                { $or: [{ cancellationEffectiveAt: null }, { cancellationEffectiveAt: { $gt: now } }] },
            ],
        });
        if (!updated) throw new AppError(UserSubscriptionMessages.CONFLICT, 409);
        await this.deliverAudit(updated._id, updated.auditOutbox ?? []);
        return this.toResponse(updated);
    }

    private auditEvent(
        actorId: string | null,
        action: AuditLogAction,
        reason: string,
        before: Record<string, unknown> | null,
        after: Record<string, unknown>,
        occurredAt: Date,
        context?: IAuditLogContext,
    ): ISubscriptionAuditEvent {
        return {
            _id: new Types.ObjectId(),
            actorId: actorId ? new Types.ObjectId(actorId) : null,
            actorType: actorId ? AuditLogActorType.USER : AuditLogActorType.SYSTEM,
            action,
            reason,
            before,
            after,
            occurredAt,
            requestId: context?.requestId ?? null,
        };
    }

    private async deliverAudit(
        subscriptionId: Types.ObjectId,
        events: ISubscriptionAuditEvent[],
    ): Promise<void> {
        for (const event of events) {
            try {
                await this.auditLogService.log({
                    actorId: event.actorId,
                    actorType: event.actorType,
                    action: event.action,
                    module: AppModule.USER_SUBSCRIPTION,
                    resourceId: subscriptionId,
                    description: event.reason,
                    requestId: event.requestId,
                    createdAt: event.occurredAt,
                    changes: [{ field: "subscription", oldValue: event.before, newValue: event.after }],
                    metadata: {
                        eventId: event._id.toString(),
                        reason: event.reason,
                        occurredAt: event.occurredAt,
                    },
                });
                await this.subscriptionRepository.acknowledgeAudit(subscriptionId, event._id);
            } catch {
                // The mutation and audit intent are already durably committed together.
                // Retry delivery from reconciliation; never roll back a newer subscription revision.
                return;
            }
        }
    }

    private snapshot(subscription: Partial<IUserSubscription>): Record<string, unknown> {
        return {
            plan: subscription.plan,
            planPriceId: subscription.planPriceId,
            status: subscription.status,
            isActive: subscription.isActive,
            endDate: subscription.endDate,
            currentPeriodEnd: subscription.currentPeriodEnd,
            autoRenew: subscription.autoRenew,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancellationEffectiveAt: subscription.cancellationEffectiveAt,
            pendingChange: subscription.pendingChange,
        };
    }

    private toResponse(subscription: UserSubscriptionRecord) {
        const {
            auditOutbox,
            paymentId,
            paymentProvider,
            providerSubscriptionId,
            providerCustomerId,
            autoRenewBeforeCancellation,
            ...response
        } = subscription;
        return response;
    }

    private assertId(id: string): void {
        if (!subscriptionObjectIdSchema.safeParse(id).success)
            throw new AppError(UserSubscriptionMessages.INVALID_ID, 400);
    }

    private parse<T>(
        schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
        input: unknown,
    ): T {
        const result = schema.safeParse(input);
        if (!result.success) throw new AppError(UserSubscriptionMessages.INVALID_INPUT, 400);
        return result.data;
    }

    private isDuplicateKey(error: unknown): boolean {
        return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    }
}
