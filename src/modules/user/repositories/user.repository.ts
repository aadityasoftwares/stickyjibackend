import { UserModel } from "../models/user.model.js";

import type { IUser, IUserFilter } from "../interfaces/user.interface.js";

import type { UserAuthProvider, UserStatus } from "../constants/user.enums.js";

export class UserRepository {
    async create(data: Partial<IUser>) {
        return UserModel.create(data);
    }

    async findById(id: string) {
        return UserModel.findOne({
            _id: id,
            isDeleted: false,
        }).populate("globalRoleId");
    }

    async findByIdIncludingDeleted(id: string) {
        return UserModel.findById(id).populate("globalRoleId");
    }

    async findByIdWithPassword(id: string) {
        return UserModel.findOne({
            _id: id,
            isDeleted: false,
        })
            .select("+password")
            .populate("globalRoleId");
    }

    async findByEmail(email: string) {
        return UserModel.findOne({
            email: email.toLowerCase().trim(),
            isDeleted: false,
        }).populate("globalRoleId");
    }

    async findByEmailWithPassword(email: string) {
        return UserModel.findOne({
            email: email.toLowerCase().trim(),
            isDeleted: false,
        })
            .select("+password")
            .populate("globalRoleId");
    }

    async findByEmailVerificationToken(tokenHash: string) {
        return UserModel.findOne({
            emailVerificationTokenHash: tokenHash,
            emailVerificationExpiresAt: {
                $gt: new Date(),
            },
            isDeleted: false,
        })
            .select("+emailVerificationTokenHash +emailVerificationExpiresAt")
            .populate("globalRoleId");
    }

    async findByPasswordResetToken(tokenHash: string) {
        return UserModel.findOne({
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: {
                $gt: new Date(),
            },
            isDeleted: false,
        })
            .select("+passwordResetTokenHash +passwordResetExpiresAt")
            .populate("globalRoleId");
    }

    async findByProvider(authProvider: UserAuthProvider, providerId: string) {
        return UserModel.findOne({
            authProvider,
            providerId,
            isDeleted: false,
        }).populate("globalRoleId");
    }

    async findAll(filters: IUserFilter = {}) {
        const {
            page = 1,
            limit = 10,
            search,
            email,
            globalRoleId,
            status,
            authProvider,
            isEmailVerified,
            isPhoneVerified,
            isMfaEnabled,
            isDeleted = false,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: any = { isDeleted };

        if (search) {
            query.$or = [
                {
                    email: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (email) {
            query.email = email.toLowerCase().trim();
        }

        if (globalRoleId) {
            query.globalRoleId = globalRoleId;
        }

        if (status) {
            query.status = status;
        }

        if (authProvider) {
            query.authProvider = authProvider;
        }

        if (isEmailVerified !== undefined) {
            query.isEmailVerified = isEmailVerified;
        }

        if (isPhoneVerified !== undefined) {
            query.isPhoneVerified = isPhoneVerified;
        }

        if (isMfaEnabled !== undefined) {
            query.isMfaEnabled = isMfaEnabled;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            UserModel.find(query)
                .populate("globalRoleId")
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),
            UserModel.countDocuments(query),
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

    async existsByEmail(email: string): Promise<boolean> {
        const exists = await UserModel.exists({
            email: email.toLowerCase().trim(),
            isDeleted: false,
        });

        return !!exists;
    }

    async existsByPhone(phone: string): Promise<boolean> {
        const exists = await UserModel.exists({
            phone,
            isDeleted: false,
        });

        return !!exists;
    }

    async existsById(id: string): Promise<boolean> {
        const exists = await UserModel.exists({
            _id: id,
            isDeleted: false,
        });

        return !!exists;
    }

    async updateById(id: string, data: Partial<IUser>) {
        return UserModel.findOneAndUpdate(
            {
                _id: id,
                isDeleted: false,
            },
            data,
            {
                new: true,
                runValidators: true,
            },
        ).populate("globalRoleId");
    }

    async updateStatus(id: string, status: UserStatus, updatedBy?: IUser["updatedBy"]) {
        return UserModel.findOneAndUpdate(
            {
                _id: id,
                isDeleted: false,
            },
            {
                status,
                ...(updatedBy !== undefined ? { updatedBy } : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate("globalRoleId");
    }

    async softDelete(id: string, updatedBy?: IUser["updatedBy"]) {
        return UserModel.findOneAndUpdate(
            {
                _id: id,
                isDeleted: false,
            },
            {
                isDeleted: true,
                deletedAt: new Date(),
                status: "INACTIVE",
                ...(updatedBy !== undefined ? { updatedBy } : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate("globalRoleId");
    }

    async restore(id: string, updatedBy?: IUser["updatedBy"]) {
        return UserModel.findOneAndUpdate(
            {
                _id: id,
                isDeleted: true,
            },
            {
                isDeleted: false,
                deletedAt: null,
                status: "ACTIVE",
                ...(updatedBy !== undefined ? { updatedBy } : {}),
            },
            {
                new: true,
                runValidators: true,
            },
        ).populate("globalRoleId");
    }

    /**
     * Hard delete is intentionally reserved for compensation rollback
     * during a failed registration.
     *
     * Do not use this for normal user deletion.
     * Normal deletion should continue using softDelete().
     */
    async hardDeleteById(id: string) {
        return UserModel.findByIdAndDelete(id).exec();
    }
}
