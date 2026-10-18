import { Types, type QueryFilter } from "mongoose";
import { UserModel } from "../../user/models/user.model.js";
import { UserSubscriptionModel } from "../models/usersubscription.model.js";
import { USER_SUBSCRIPTION_CONSTANTS } from "../constants/usersubscription.constants.js";
import { UserSubscriptionStatus } from "../constants/usersubscription.enums.js";
import type {
    IUserSubscription,
    ISubscriptionAuditEvent,
    UserSubscriptionRecord,
    UserSubscriptionUpdate,
} from "../interfaces/usersubscription.interface.js";
import type { AdminSubscriptionFilters } from "../validations/usersubscription.schema.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

const SUBSCRIPTION_FIELDS = [
    "_id",
    "user",
    "plan",
    "planPriceId",
    "billingInterval",
    "status",
    "startDate",
    "endDate",
    "currentPeriodStart",
    "currentPeriodEnd",
    "autoRenew",
    "autoRenewBeforeCancellation",
    "cancelAtPeriodEnd",
    "canceledAt",
    "cancellationEffectiveAt",
    "cancellationReason",
    "pendingChange",
    "isActive",
    "revision",
    "createdAt",
    "updatedAt",
].join(" ");

export class UserSubscriptionRepository {
    async findAccount(userId: string) {
        return UserModel.findOne({ _id: userId, isDeleted: false }).select("_id status").lean().exec();
    }

    async create(data: Partial<IUserSubscription>): Promise<UserSubscriptionRecord> {
        const subscription = await UserSubscriptionModel.create(data);
        return subscription.toObject();
    }

    async findCurrentByUser(user: string): Promise<UserSubscriptionRecord | null> {
        return UserSubscriptionModel.findOne({ user, isActive: true })
            .select(
                SUBSCRIPTION_FIELDS +
                    " +paymentId +paymentProvider +providerSubscriptionId +providerCustomerId +auditOutbox",
            )
            .lean<UserSubscriptionRecord>()
            .exec();
    }

    async findByProviderSubscriptionId(
        provider: string,
        providerSubscriptionId: string,
    ): Promise<UserSubscriptionRecord | null> {
        return UserSubscriptionModel.findOne({ paymentProvider: provider, providerSubscriptionId })
            .select(
                SUBSCRIPTION_FIELDS +
                    " +paymentId +paymentProvider +providerSubscriptionId +providerCustomerId +auditOutbox",
            )
            .lean<UserSubscriptionRecord>()
            .exec();
    }

    async findByIdForUser(id: string, user: string): Promise<UserSubscriptionRecord | null> {
        return UserSubscriptionModel.findOne({ _id: id, user })
            .select(SUBSCRIPTION_FIELDS)
            .lean<UserSubscriptionRecord>()
            .exec();
    }

    async findByIdForAdmin(id: string): Promise<UserSubscriptionRecord | null> {
        return UserSubscriptionModel.findById(id)
            .select(SUBSCRIPTION_FIELDS)
            .lean<UserSubscriptionRecord>()
            .exec();
    }

    async list(filters: AdminSubscriptionFilters, authorizedUser?: string) {
        const query: QueryFilter<IUserSubscription> = {};
        if (authorizedUser ?? filters.user) query.user = new Types.ObjectId(authorizedUser ?? filters.user);
        if (filters.plan) query.plan = new Types.ObjectId(filters.plan);
        if (filters.status) query.status = filters.status;
        if (filters.search) {
            const literal = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { status: { $regex: literal, $options: "i" } },
                { cancellationReason: { $regex: literal, $options: "i" } },
            ];
        }
        const { skip, limit } = getPagination(filters.page, filters.limit);
        const direction = filters.sortOrder === "asc" ? 1 : -1;
        const [data, total] = await Promise.all([
            UserSubscriptionModel.find(query)
                .select(SUBSCRIPTION_FIELDS)
                .sort({ [filters.sortBy]: direction, _id: direction })
                .skip(skip)
                .limit(limit)
                .lean<UserSubscriptionRecord[]>()
                .exec(),
            UserSubscriptionModel.countDocuments(query).exec(),
        ]);
        return { data, pagination: paginationMeta(filters.page, limit, total) };
    }

    async compareAndSet(
        previous: UserSubscriptionRecord,
        data: UserSubscriptionUpdate,
        event: ISubscriptionAuditEvent,
        eligibility: QueryFilter<IUserSubscription> = {},
    ): Promise<UserSubscriptionRecord | null> {
        return UserSubscriptionModel.findOneAndUpdate(
            {
                _id: previous._id,
                user: previous.user,
                status: previous.status,
                isActive: previous.isActive,
                revision: previous.revision ?? { $exists: false },
                ...eligibility,
                $expr: {
                    $lt: [
                        { $size: { $ifNull: ["$auditOutbox", []] } },
                        USER_SUBSCRIPTION_CONSTANTS.MAX_AUDIT_OUTBOX,
                    ],
                },
            },
            {
                $set: data,
                $inc: { revision: 1 },
                $push: { auditOutbox: event },
            },
            { returnDocument: "after", runValidators: true },
        )
            .select(SUBSCRIPTION_FIELDS + " +auditOutbox")
            .lean<UserSubscriptionRecord>()
            .exec();
    }

    dueFilter(now: Date): QueryFilter<IUserSubscription> {
        const cutoff = new Date(now.getTime() - USER_SUBSCRIPTION_CONSTANTS.RECONCILIATION_DELAY_MS);
        return {
            isActive: true,
            status: { $in: [UserSubscriptionStatus.ACTIVE, UserSubscriptionStatus.PAST_DUE] },
            $or: [
                { cancelAtPeriodEnd: true, cancellationEffectiveAt: { $type: "date", $lte: now } },
                { currentPeriodEnd: { $type: "date", $lte: cutoff } },
                { currentPeriodEnd: null, endDate: { $type: "date", $lte: cutoff } },
            ],
        };
    }

    async findDue(now: Date, limit: number, afterId?: string): Promise<UserSubscriptionRecord[]> {
        return UserSubscriptionModel.find({
            ...this.dueFilter(now),
            ...(afterId ? { _id: { $gt: new Types.ObjectId(afterId) } } : {}),
        })
            .select(SUBSCRIPTION_FIELDS + " +auditOutbox")
            .sort({ _id: 1 })
            .limit(limit)
            .lean<UserSubscriptionRecord[]>()
            .exec();
    }

    async findAuditBacklog(limit: number): Promise<UserSubscriptionRecord[]> {
        return UserSubscriptionModel.find({ "auditOutbox.0": { $exists: true } })
            .select("_id auditOutbox")
            .sort({ "auditOutbox.occurredAt": 1, _id: 1 })
            .limit(limit)
            .lean<UserSubscriptionRecord[]>()
            .exec();
    }

    async acknowledgeAudit(subscriptionId: Types.ObjectId, eventId: Types.ObjectId): Promise<void> {
        await UserSubscriptionModel.updateOne(
            { _id: subscriptionId },
            { $pull: { auditOutbox: { _id: eventId } } },
            { timestamps: false },
        ).exec();
    }
}
