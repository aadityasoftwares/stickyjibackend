import { Types, type ClientSession } from "mongoose";
import { PlanFeatureModel } from "../../planfeature/models/planfeature.model.js";
import { WorkspaceModel } from "../../workspace/models/workspace.model.js";
import { WorkspaceFolderModel } from "../../workspaceFolders/models/workspaceFolder.model.js";
import { StickyNoteModel } from "../../stickynotes/models/stickyNote.model.js";
import { SubscriptionReservationModel } from "../models/subscriptionreservation.model.js";
import { ReservationStatus } from "../constants/subscriptionentitlement.enums.js";
import type { BillingScopeType } from "../../subscriptionusage/constants/subscriptionusage.enums.js";
import type {
    ISubscriptionReservation,
    ISubscriptionReservationDocument,
    PlanLimitsMap,
} from "../interfaces/subscriptionentitlement.interface.js";

export class SubscriptionEntitlementRepository {
    async findPlanLimits(
        planId: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<PlanLimitsMap> {
        const query = PlanFeatureModel.find({
            planId: new Types.ObjectId(String(planId)),
        }).populate("featureId");

        if (session) query.session(session);

        const planFeatures = await query.lean().exec();
        const limitsMap: PlanLimitsMap = {};

        for (const pf of planFeatures) {
            const feature = pf.featureId as unknown as { code?: string } | null;
            if (feature?.code) {
                limitsMap[feature.code] = {
                    limit: typeof pf.limit === "number" ? pf.limit : 0,
                    isUnlimited: Boolean(pf.isUnlimited),
                    isEnabled: pf.isEnabled !== false,
                };
            }
        }

        return limitsMap;
    }

    async getPendingReservationAmount(
        scopeType: BillingScopeType,
        scopeId: Types.ObjectId,
        resource: string,
        workspaceId?: Types.ObjectId | null,
        session?: ClientSession,
    ): Promise<number> {
        const matchCriteria: Record<string, unknown> = {
            scopeType,
            scopeId,
            resource,
            status: ReservationStatus.PENDING,
            expiresAt: { $gt: new Date() },
        };

        if (workspaceId) {
            matchCriteria.workspaceId = workspaceId;
        }

        const pipeline = [
            { $match: matchCriteria },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ];

        const aggregation = SubscriptionReservationModel.aggregate(pipeline);
        if (session) aggregation.session(session);

        const results = await aggregation.exec();
        return results.length > 0 && typeof results[0].total === "number" ? results[0].total : 0;
    }

    async getPendingReservationAmountUpTo(
        scopeType: string,
        scopeId: Types.ObjectId,
        resource: string,
        reservationId: Types.ObjectId,
        workspaceId?: Types.ObjectId | null,
        session?: ClientSession,
    ): Promise<number> {
        const matchCriteria: Record<string, unknown> = {
            scopeType,
            scopeId,
            resource,
            status: ReservationStatus.PENDING,
            _id: { $lte: reservationId },
            expiresAt: { $gt: new Date() },
        };

        if (workspaceId) {
            matchCriteria.workspaceId = workspaceId;
        }

        const pipeline = [
            { $match: matchCriteria },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" },
                },
            },
        ];

        const aggregation = SubscriptionReservationModel.aggregate(pipeline);
        if (session) aggregation.session(session);

        const results = await aggregation.exec();
        return results.length > 0 && typeof results[0].total === "number" ? results[0].total : 0;
    }

    async createReservation(
        data: Partial<ISubscriptionReservation>,
        session?: ClientSession,
    ): Promise<ISubscriptionReservationDocument> {
        try {
            if (session) {
                const docs = await SubscriptionReservationModel.create([data], { session });
                return docs[0];
            }
            return await SubscriptionReservationModel.create(data);
        } catch (error: any) {
            // Idempotent retry: if duplicate operationId, return the existing reservation
            if (error?.code === 11000 && data.operationId) {
                const existing = await this.findReservationByOperationId(data.operationId, session);
                if (existing) return existing;
            }
            throw error;
        }
    }

    async findReservationById(
        id: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<ISubscriptionReservationDocument | null> {
        const query = SubscriptionReservationModel.findById(new Types.ObjectId(String(id)));
        if (session) query.session(session);
        return query.exec();
    }

    async findReservationByOperationId(
        operationId: string,
        session?: ClientSession,
    ): Promise<ISubscriptionReservationDocument | null> {
        const query = SubscriptionReservationModel.findOne({ operationId: operationId.trim() });
        if (session) query.session(session);
        return query.exec();
    }

    async commitReservation(
        id: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<ISubscriptionReservationDocument | null> {
        const query = SubscriptionReservationModel.findByIdAndUpdate(
            new Types.ObjectId(String(id)),
            { $set: { status: ReservationStatus.COMMITTED } },
            { returnDocument: "after" },
        );
        if (session) query.session(session);
        return query.exec();
    }

    async releaseReservation(
        id: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<ISubscriptionReservationDocument | null> {
        const query = SubscriptionReservationModel.findByIdAndUpdate(
            new Types.ObjectId(String(id)),
            { $set: { status: ReservationStatus.RELEASED } },
            { returnDocument: "after" },
        );
        if (session) query.session(session);
        return query.exec();
    }

    async expireStaleReservations(
        now: Date = new Date(),
        session?: ClientSession,
    ): Promise<number> {
        const result = await SubscriptionReservationModel.updateMany(
            {
                status: ReservationStatus.PENDING,
                expiresAt: { $lte: now },
            },
            {
                $set: { status: ReservationStatus.EXPIRED },
            },
            { session },
        );
        return result.modifiedCount;
    }

    // Lean read-ports for billing scope resolution without circular service dependencies
    async findWorkspaceOwner(
        workspaceId: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<Types.ObjectId | null> {
        const query = WorkspaceModel.findById(new Types.ObjectId(String(workspaceId)))
            .select("ownerId")
            .lean();
        if (session) query.session(session);
        const ws = await query.exec();
        return ws ? (ws.ownerId as Types.ObjectId) : null;
    }

    async findFolderWorkspaceAndOwner(
        folderId: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<{ workspaceId: Types.ObjectId; ownerId: Types.ObjectId } | null> {
        const folderQuery = WorkspaceFolderModel.findById(new Types.ObjectId(String(folderId)))
            .select("workspaceId")
            .lean();
        if (session) folderQuery.session(session);
        const folder = await folderQuery.exec();
        if (!folder || !folder.workspaceId) return null;

        const ownerId = await this.findWorkspaceOwner(folder.workspaceId, session);
        if (!ownerId) return null;

        return {
            workspaceId: folder.workspaceId as Types.ObjectId,
            ownerId,
        };
    }

    async findNoteWorkspaceAndOwner(
        noteId: string | Types.ObjectId,
        session?: ClientSession,
    ): Promise<{ workspaceId: Types.ObjectId; ownerId: Types.ObjectId } | null> {
        const noteQuery = StickyNoteModel.findById(new Types.ObjectId(String(noteId)))
            .select("workspaceId")
            .lean();
        if (session) noteQuery.session(session);
        const note = await noteQuery.exec();
        if (!note || !note.workspaceId) return null;

        const ownerId = await this.findWorkspaceOwner(note.workspaceId, session);
        if (!ownerId) return null;

        return {
            workspaceId: note.workspaceId as Types.ObjectId,
            ownerId,
        };
    }
}
