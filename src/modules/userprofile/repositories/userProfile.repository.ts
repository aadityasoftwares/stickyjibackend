import { Types } from "mongoose";

import { UserProfileModel } from "../models/userProfile.model.js";

import type {
    IUserProfileCreate,
    IUserProfileFilter,
    IUserProfileUpdate,
} from "../interfaces/userProfile.interface.js";

/*
 * Only fields required by frontend.
 *
 * Important:
 * - No __v
 * - No populated Country object
 * - No populated Timezone object
 * - No populated Language object
 * - No populated Currency object
 *
 * countryId/timezoneId/languageId/currencyId
 * will remain ObjectIds and will be serialized
 * as strings in JSON responses.
 */
const USER_PROFILE_PUBLIC_FIELDS = [
    "_id",
    "userId",

    "firstName",
    "lastName",
    "displayName",
    "bio",
    "dateOfBirth",

    "profileType",
    "occupation",
    "education",
    "interests",

    "countryId",
    "timezoneId",
    "languageId",
    "currencyId",
    "profileImage",

    "createdAt",
    "updatedAt",
].join(" ");

export class UserProfileRepository {
    async create(data: IUserProfileCreate) {
        const profile = await UserProfileModel.create(data);

        /*
         * Model.create() returns the complete mongoose
         * document including __v.
         *
         * Re-fetch using our public projection so every
         * API uses the same response structure.
         */
        return this.findById(profile._id.toString());
    }

    async findById(id: string) {
        return UserProfileModel.findById(id).select(USER_PROFILE_PUBLIC_FIELDS);
    }

    async findByUserId(userId: string) {
        return UserProfileModel.findOne({
            userId: new Types.ObjectId(userId),
        }).select(USER_PROFILE_PUBLIC_FIELDS);
    }

    async existsByUserId(userId: string): Promise<boolean> {
        const exists = await UserProfileModel.exists({
            userId: new Types.ObjectId(userId),
        });

        return !!exists;
    }

    async updateByUserId(userId: string, data: IUserProfileUpdate) {
        return UserProfileModel.findOneAndUpdate(
            {
                userId: new Types.ObjectId(userId),
            },
            data,
            {
                new: true,
                runValidators: true,
            },
        ).select(USER_PROFILE_PUBLIC_FIELDS);
    }

    async findAll(filters: IUserProfileFilter = {}) {
        const {
            userId,
            profileType,

            countryId,
            timezoneId,
            languageId,
            currencyId,

            search,

            page = 1,
            limit = 10,

            sortBy = "createdAt",
            sortOrder = "desc",
        } = filters;

        const query: Record<string, unknown> = {};

        if (userId) {
            query.userId = new Types.ObjectId(userId.toString());
        }

        if (profileType) {
            query.profileType = profileType;
        }

        if (countryId) {
            query.countryId = new Types.ObjectId(countryId.toString());
        }

        if (timezoneId) {
            query.timezoneId = new Types.ObjectId(timezoneId.toString());
        }

        if (languageId) {
            query.languageId = new Types.ObjectId(languageId.toString());
        }

        if (currencyId) {
            query.currencyId = new Types.ObjectId(currencyId.toString());
        }

        if (search) {
            query.$or = [
                {
                    firstName: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    lastName: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    displayName: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    occupation: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            UserProfileModel.find(query)
                .select(USER_PROFILE_PUBLIC_FIELDS)
                .sort({
                    [sortBy]: sortOrder === "asc" ? 1 : -1,
                })
                .skip(skip)
                .limit(limit),

            UserProfileModel.countDocuments(query),
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
