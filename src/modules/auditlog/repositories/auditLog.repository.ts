import { AuditLogModel } from "../models/auditLog.model.js";
import type { ClientSession } from "mongoose";
import type { IAuditLog, IAuditLogDocument, IAuditLogFilter } from "../interfaces/auditLog.interface.js";

export class AuditLogRepository {
    async create(data: Partial<IAuditLog>): Promise<IAuditLogDocument> {
        return AuditLogModel.create(data);
    }

    async createMany(data: Partial<IAuditLog>[], session?: ClientSession) {
        return AuditLogModel.insertMany(data, { session });
    }

    async findById(id: string): Promise<IAuditLogDocument | null> {
        return AuditLogModel.findById(id).populate("actorId", "firstName lastName email").lean();
    }

    async findAll(filters: IAuditLogFilter = {}) {
        const {
            page = 1,
            limit = 20,
            search,
            module,
            action,
            status,
            severity,
            actorType,
            actorId,
            resourceType,
            resourceId,
            workspaceId,
            startDate,
            endDate,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: Record<string, any> = {};

        if (search?.trim()) {
            const searchRegex = {
                $regex: search.trim(),
                $options: "i",
            };

            query.$or = [
                { description: searchRegex },
                { resourceName: searchRegex },
                { resourceType: searchRegex },
                { requestId: searchRegex },
            ];
        }

        if (module) query.module = module;
        if (action) query.action = action;
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (actorType) query.actorType = actorType;
        if (actorId) query.actorId = actorId;
        if (resourceType) query.resourceType = resourceType;
        if (resourceId) query.resourceId = resourceId;
        if (workspaceId) query["metadata.workspaceId"] = workspaceId;

        if (startDate || endDate) {
            query.createdAt = {};

            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }

            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const skip = (page - 1) * limit;
        const sortDirection = sortOrder === "asc" ? 1 : -1;

        const [data, total] = await Promise.all([
            AuditLogModel.find(query)
                .populate("actorId", "firstName lastName email")
                .sort({ [sortBy]: sortDirection })
                .skip(skip)
                .limit(limit)
                .lean(),
            AuditLogModel.countDocuments(query),
        ]);

        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
