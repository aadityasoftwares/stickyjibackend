import type { Document, Types } from "mongoose";

import type { UserProfileType } from "../constants/userProfile.enums.js";

export interface IUserProfile {
    userId: Types.ObjectId;

    firstName: string;
    lastName: string;

    displayName?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;

    profileType: UserProfileType;

    occupation?: string | null;
    education?: string | null;
    interests?: string[];

    countryId?: Types.ObjectId | null;
    timezoneId?: Types.ObjectId | null;
    languageId?: Types.ObjectId | null;
    currencyId?: Types.ObjectId | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUserProfileDocument extends IUserProfile, Document {}

export interface IUserProfileCreate {
    userId: Types.ObjectId | string;

    firstName: string;
    lastName: string;

    displayName?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;

    profileType?: UserProfileType;

    occupation?: string | null;
    education?: string | null;
    interests?: string[];

    countryId?: Types.ObjectId | string | null;

    timezoneId?: Types.ObjectId | string | null;

    languageId?: Types.ObjectId | string | null;

    currencyId?: Types.ObjectId | string | null;
}

export interface IUserProfileUpdate {
    firstName?: string;
    lastName?: string;

    displayName?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;

    profileType?: UserProfileType;

    occupation?: string | null;
    education?: string | null;
    interests?: string[];

    countryId?: Types.ObjectId | string | null;

    timezoneId?: Types.ObjectId | string | null;

    languageId?: Types.ObjectId | string | null;

    currencyId?: Types.ObjectId | string | null;
}

export interface IUserProfileFilter {
    userId?: Types.ObjectId | string;

    profileType?: UserProfileType;

    countryId?: Types.ObjectId | string;

    timezoneId?: Types.ObjectId | string;

    languageId?: Types.ObjectId | string;

    currencyId?: Types.ObjectId | string;

    search?: string;

    page?: number;
    limit?: number;

    sortBy?: string;

    sortOrder?: "asc" | "desc";
}

/*
 * Exact response Angular receives.
 *
 * Database relation objects are intentionally
 * not exposed.
 */
export interface IUserProfileResponse {
    id: string;
    userId: string;

    firstName: string;
    lastName: string;

    displayName: string | null;
    bio: string | null;
    dateOfBirth: Date | null;

    profileType: UserProfileType;

    occupation: string | null;
    education: string | null;

    interests: string[];

    countryId: string | null;
    timezoneId: string | null;
    languageId: string | null;
    currencyId: string | null;
}
