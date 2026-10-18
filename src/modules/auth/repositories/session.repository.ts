import { SessionModel } from "../models/session.model.js";
import type { ISessionDocument } from "../interfaces/session.interface.js";
import { SessionStatus } from "../constants/session.constants.js";

export class SessionRepository {
    async create(data: Partial<ISessionDocument>): Promise<ISessionDocument> {
        return SessionModel.create(data);
    }

    async findById(sessionId: string): Promise<ISessionDocument | null> {
        return SessionModel.findOne({
            _id: sessionId,
        });
    }

    async findByIdWithRefreshToken(sessionId: string): Promise<ISessionDocument | null> {
        return SessionModel.findOne({
            _id: sessionId,
        }).select("+refreshTokenHash");
    }

    async findActiveById(sessionId: string): Promise<ISessionDocument | null> {
        return SessionModel.findOne({
            _id: sessionId,
            status: SessionStatus.ACTIVE,
        });
    }

    async findActiveByUserId(userId: string): Promise<ISessionDocument[]> {
        return SessionModel.find({
            userId,
            status: SessionStatus.ACTIVE,
        }).sort({
            lastUsedAt: -1,
        });
    }

    async findActiveByUserAndDevice(userId: string, deviceId: string): Promise<ISessionDocument | null> {
        return SessionModel.findOne({
            userId,
            deviceId,
            status: SessionStatus.ACTIVE,
        }).select("+refreshTokenHash");
    }

    async updateRefreshToken(
        sessionId: string,
        refreshTokenHash: string,
        refreshTokenVersion: number,
        lastIpAddress?: string,
    ): Promise<ISessionDocument | null> {
        return SessionModel.findOneAndUpdate(
            {
                _id: sessionId,
                status: SessionStatus.ACTIVE,
            },
            {
                refreshTokenHash,
                refreshTokenVersion,
                lastRefreshAt: new Date(),
                lastUsedAt: new Date(),
                ...(lastIpAddress !== undefined && {
                    lastIpAddress,
                }),
            },
            {
                new: true,
                runValidators: true,
            },
        );
    }

    async updateLastUsed(sessionId: string, lastIpAddress?: string): Promise<ISessionDocument | null> {
        return SessionModel.findOneAndUpdate(
            {
                _id: sessionId,
                status: SessionStatus.ACTIVE,
            },
            {
                lastUsedAt: new Date(),
                ...(lastIpAddress !== undefined ? { lastIpAddress } : {}),
            },
            {
                new: true,
            },
        );
    }

    async revoke(sessionId: string, revokedAt = new Date()): Promise<ISessionDocument | null> {
        return SessionModel.findOneAndUpdate(
            {
                _id: sessionId,
                status: SessionStatus.ACTIVE,
            },
            {
                status: SessionStatus.REVOKED,
                revokedAt,
            },
            {
                new: true,
            },
        );
    }

    async revokeAllByUserId(userId: string): Promise<{ modifiedCount: number }> {
        const result = await SessionModel.updateMany(
            {
                userId,
                status: SessionStatus.ACTIVE,
            },
            {
                status: SessionStatus.REVOKED,
                revokedAt: new Date(),
            },
        );

        return {
            modifiedCount: result.modifiedCount,
        };
    }

    async deleteExpiredSessions(): Promise<{ deletedCount: number }> {
        const result = await SessionModel.deleteMany({
            expiresAt: {
                $lt: new Date(),
            },
        });

        return {
            deletedCount: result.deletedCount,
        };
    }
}
