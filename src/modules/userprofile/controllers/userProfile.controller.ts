import type { Request, Response, NextFunction } from "express";

import { UserProfileService } from "../services/userProfile.service.js";
import { UserProfileMessages } from "../constants/userProfile.messages.js";

import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class UserProfileController {
    private userProfileService: UserProfileService;

    constructor() {
        this.userProfileService = new UserProfileService();
    }

    createProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const context = {
                actorId: req.user?.id ?? null,
                ipAddress: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null,
                requestId: req.headers["x-request-id"]?.toString() ?? null,
            };

            const profile = await this.userProfileService.createProfile(
                {
                    ...req.body,
                    userId: req.user?.id,
                },
                context,
            );

            return res.status(201).json(ResponseUtil.created(UserProfileMessages.CREATED, profile));
        } catch (error) {
            next(error);
        }
    };

    getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profile = await this.userProfileService.getMyProfile(req.user?.id as string);

            return res.status(200).json(ResponseUtil.success(UserProfileMessages.FETCHED, profile));
        } catch (error) {
            next(error);
        }
    };

    getProfileById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profile = await this.userProfileService.getProfileById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(UserProfileMessages.FETCHED, profile));
        } catch (error) {
            next(error);
        }
    };

    getProfiles = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profiles = await this.userProfileService.getProfiles({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string | undefined,
                profileType: req.query.profileType as any,
                countryId: req.query.countryId as string | undefined,
                timezoneId: req.query.timezoneId as string | undefined,
                languageId: req.query.languageId as string | undefined,
                currencyId: req.query.currencyId as string | undefined,
                sortBy: req.query.sortBy as string | undefined,
                sortOrder: req.query.sortOrder as "asc" | "desc" | undefined,
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        UserProfileMessages.FETCHED,
                        profiles.data,
                        profiles.pagination.page,
                        profiles.pagination.limit,
                        profiles.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const context = {
                actorId: req.user?.id ?? null,
                ipAddress: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null,
                requestId: req.headers["x-request-id"]?.toString() ?? null,
            };

            const profile = await this.userProfileService.updateMyProfile(
                req.user?.id as string,
                req.body,
                context,
            );

            return res.status(200).json(ResponseUtil.success(UserProfileMessages.UPDATED, profile));
        } catch (error) {
            next(error);
        }
    };

    updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const context = {
                actorId: req.user?.id ?? null,
                ipAddress: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null,
                requestId: req.headers["x-request-id"]?.toString() ?? null,
            };

            const profile = await this.userProfileService.updateProfile(
                RequestUtil.getParam(req.params.id),
                req.body,
                context,
            );

            return res.status(200).json(ResponseUtil.success(UserProfileMessages.UPDATED, profile));
        } catch (error) {
            next(error);
        }
    };

    setProfileImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const context = {
                actorId: req.user?.id ?? null,
                ipAddress: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null,
                requestId: req.headers["x-request-id"]?.toString() ?? null,
            };

            const profile = await this.userProfileService.setProfileImage(
                req.user?.id as string,
                req.body.mediaId,
                context,
            );

            return res
                .status(200)
                .json(ResponseUtil.success(UserProfileMessages.PROFILE_IMAGE_UPLOADED, profile));
        } catch (error) {
            next(error);
        }
    };

    removeProfileImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const context = {
                actorId: req.user?.id ?? null,
                ipAddress: req.ip ?? null,
                userAgent: req.get("user-agent") ?? null,
                requestId: req.headers["x-request-id"]?.toString() ?? null,
            };

            const profile = await this.userProfileService.removeProfileImage(
                req.user?.id as string,
                context,
            );

            return res
                .status(200)
                .json(ResponseUtil.success(UserProfileMessages.PROFILE_IMAGE_REMOVED, profile));
        } catch (error) {
            next(error);
        }
    };

    requestProfileImageUpload = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.userProfileService.requestProfileImageUpload(
                req.user?.id as string,
                req.body,
            );

            return res
                .status(201)
                .json(ResponseUtil.created("Profile image upload URL generated successfully.", result));
        } catch (error) {
            next(error);
        }
    };

    getMyProfileImage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const profile = await this.userProfileService.getMyProfile(req.user?.id as string);

            return res.status(200).json(
                ResponseUtil.success(UserProfileMessages.FETCHED, {
                    profileImage: profile.profileImage,
                    avatarUrl: profile.avatarUrl,
                }),
            );
        } catch (error) {
            next(error);
        }
    };
}
