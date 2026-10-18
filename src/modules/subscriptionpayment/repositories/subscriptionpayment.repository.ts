import { Types, type QueryFilter } from "mongoose";
import { SubscriptionPaymentModel } from "../models/subscriptionpayment.model.js";
import { PaymentStatus } from "../constants/subscriptionpayment.enums.js";
import type {
    ISubscriptionPayment,
    SubscriptionPaymentRecord,
} from "../interfaces/subscriptionpayment.interface.js";
import { getPagination, paginationMeta } from "../../../utils/pagination.util.js";

export class SubscriptionPaymentRepository {
    async create(data: Partial<ISubscriptionPayment>): Promise<SubscriptionPaymentRecord> {
        const doc = await SubscriptionPaymentModel.create(data);
        return doc.toObject() as SubscriptionPaymentRecord;
    }

    async findById(id: string | Types.ObjectId): Promise<SubscriptionPaymentRecord | null> {
        return SubscriptionPaymentModel.findById(id).lean<SubscriptionPaymentRecord>().exec();
    }

    async findByProviderPaymentId(
        provider: string,
        providerPaymentId: string,
    ): Promise<SubscriptionPaymentRecord | null> {
        return SubscriptionPaymentModel.findOne({ provider, providerPaymentId })
            .lean<SubscriptionPaymentRecord>()
            .exec();
    }

    async findLatestByProviderSubscriptionId(
        providerSubscriptionId: string,
    ): Promise<SubscriptionPaymentRecord | null> {
        return SubscriptionPaymentModel.findOne({ providerSubscriptionId })
            .sort({ createdAt: -1 })
            .lean<SubscriptionPaymentRecord>()
            .exec();
    }

    async upsertCapturedPayment(
        criteria: { provider: string; providerPaymentId: string },
        data: Partial<ISubscriptionPayment>,
    ): Promise<SubscriptionPaymentRecord> {
        const record = await SubscriptionPaymentModel.findOneAndUpdate(
            criteria,
            {
                $set: {
                    ...data,
                    status: PaymentStatus.CAPTURED,
                    capturedAt: data.capturedAt ?? new Date(),
                },
            },
            { new: true, upsert: true, runValidators: true },
        ).lean<SubscriptionPaymentRecord>().exec();

        return record as SubscriptionPaymentRecord;
    }

    async updateStatus(
        id: Types.ObjectId | string,
        status: PaymentStatus,
        extra: Partial<ISubscriptionPayment> = {},
    ): Promise<SubscriptionPaymentRecord | null> {
        return SubscriptionPaymentModel.findByIdAndUpdate(
            id,
            { $set: { status, ...extra } },
            { new: true, runValidators: true },
        ).lean<SubscriptionPaymentRecord>().exec();
    }

    async listByUser(userId: string | Types.ObjectId, page = 1, limit = 20) {
        const query: QueryFilter<ISubscriptionPayment> = { user: new Types.ObjectId(userId.toString()) };
        const { skip, limit: parsedLimit } = getPagination(page, limit);

        const [data, total] = await Promise.all([
            SubscriptionPaymentModel.find(query)
                .populate("planId", "name code type")
                .populate("planPriceId", "amountMinor currencyId billingInterval")
                .sort({ createdAt: -1, _id: -1 })
                .skip(skip)
                .limit(parsedLimit)
                .lean<SubscriptionPaymentRecord[]>()
                .exec(),
            SubscriptionPaymentModel.countDocuments(query).exec(),
        ]);

        return {
            data,
            pagination: paginationMeta(page, parsedLimit, total),
        };
    }
}
