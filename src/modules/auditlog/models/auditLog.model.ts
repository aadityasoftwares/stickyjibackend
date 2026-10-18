import mongoose, { Model, Schema } from "mongoose";
import type { IAuditLogDocument } from "../interfaces/auditLog.interface.js";
import {
    AuditLogAction,
    AuditLogActorType,
    AuditLogSeverity,
    AuditLogStatus,
} from "../constants/auditLog.enums.js";
import { AppModule } from "../../../utils/enums/appModule.enums.js";

const AuditLogChangeSchema = new Schema(
    {
        field: {
            type: String,
            required: true,
            trim: true,
        },
        oldValue: {
            type: Schema.Types.Mixed,
            default: null,
        },
        newValue: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const AuditLogSchema = new Schema<IAuditLogDocument>(
    {
        actorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        actorType: {
            type: String,
            enum: Object.values(AuditLogActorType),
            required: true,
            default: AuditLogActorType.USER,
        },
        action: {
            type: String,
            enum: Object.values(AuditLogAction),
            required: true,
            index: true,
        },
        module: {
            type: String,
            enum: Object.values(AppModule),
            required: true,
            index: true,
        },
        resourceType: {
            type: String,
            trim: true,
            default: null,
        },
        resourceId: {
            type: Schema.Types.Mixed,
            default: null,
            index: true,
        },
        resourceName: {
            type: String,
            trim: true,
            default: null,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(AuditLogStatus),
            required: true,
            index: true,
        },
        severity: {
            type: String,
            enum: Object.values(AuditLogSeverity),
            required: true,
            default: AuditLogSeverity.INFO,
            index: true,
        },
        changes: {
            type: [AuditLogChangeSchema],
            default: [],
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: () => ({}),
        },
        ipAddress: {
            type: String,
            trim: true,
            default: null,
        },
        userAgent: {
            type: String,
            trim: true,
            default: null,
        },
        requestId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

AuditLogSchema.index({
    module: 1,
    action: 1,
    createdAt: -1,
});

AuditLogSchema.index({
    actorId: 1,
    createdAt: -1,
});

AuditLogSchema.index({
    resourceId: 1,
    createdAt: -1,
});

AuditLogSchema.index({
    workspaceId: 1,
    createdAt: -1,
});

AuditLogSchema.index({
    createdAt: -1,
});

export const AuditLogModel: Model<IAuditLogDocument> =
    mongoose.model<IAuditLogDocument>(
        "AuditLog",
        AuditLogSchema
    );