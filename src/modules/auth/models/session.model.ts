import mongoose, { Model, Schema } from "mongoose";

import type { ISessionDocument } from "../interfaces/session.interface.js";
import { SessionRevokedReason, SessionStatus, SessionType } from "../constants/session.constants.js";

const SessionSchema = new Schema<ISessionDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: Object.values(SessionType),
            required: true,
            default: SessionType.WEB,
            index: true,
        },
        refreshTokenHash: {
            type: String,
            required: true,
            select: false,
        },
        refreshTokenVersion: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
        },
        status: {
            type: String,
            enum: Object.values(SessionStatus),
            required: true,
            default: SessionStatus.ACTIVE,
            index: true,
        },
        deviceId: {
            type: String,
            default: null,
            trim: true,
        },
        deviceName: {
            type: String,
            default: null,
            trim: true,
            maxlength: 200,
        },
        userAgent: {
            type: String,
            default: null,
            trim: true,
            maxlength: 1000,
        },
        createdIpAddress: {
            type: String,
            default: null,
            trim: true,
        },
        lastIpAddress: {
            type: String,
            default: null,
            trim: true,
        },
        lastRefreshIpAddress: {
            type: String,
            default: null,
            trim: true,
        },
        lastUsedAt: {
            type: Date,
            default: null,
        },
        lastRefreshAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        revokedReason: {
            type: String,
            enum: Object.values(SessionRevokedReason),
            default: null,
        },
        revokedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

SessionSchema.index({ userId: 1 });
SessionSchema.index({ userId: 1, status: 1 });
SessionSchema.index({ userId: 1, deviceId: 1 });
SessionSchema.index({ expiresAt: 1 });
SessionSchema.index({ status: 1, expiresAt: 1 });

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel: Model<ISessionDocument> = mongoose.model<ISessionDocument>(
    "Session",
    SessionSchema,
);
