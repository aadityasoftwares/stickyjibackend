import type { Document, Types } from "mongoose";

import { SessionRevokedReason, SessionStatus, SessionType } from "../constants/session.constants.js";

export interface ISession {
    userId: Types.ObjectId;
    type: SessionType;
    refreshTokenHash: string;
    refreshTokenVersion: number;
    status: SessionStatus;

    deviceId?: string | null;
    deviceName?: string | null;
    userAgent?: string | null;

    createdIpAddress?: string | null;
    lastIpAddress?: string | null;
    lastRefreshIpAddress?: string | null;

    lastUsedAt?: Date | null;
    lastRefreshAt?: Date | null;

    expiresAt: Date;

    revokedAt?: Date | null;
    revokedReason?: SessionRevokedReason | null;
    revokedBy?: Types.ObjectId | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISessionDocument extends ISession, Document {}

export interface ISessionResponse {
    id: string;
    userId: string;
    type: SessionType;
    status: SessionStatus;
    deviceId?: string | null;
    deviceName?: string | null;
    userAgent?: string | null;
    createdIpAddress?: string | null;
    lastIpAddress?: string | null;
    lastRefreshIpAddress?: string | null;
    lastUsedAt?: Date | null;
    lastRefreshAt?: Date | null;
    expiresAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
