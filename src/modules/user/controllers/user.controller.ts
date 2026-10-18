import type { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service.js";
import { UserMessages } from "../constants/user.messages.js";
import { ResponseUtil } from "../../../utils/response.util.js";
import { RequestUtil } from "../../../utils/request.util.js";

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    createUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.createUser(req.body);

            return res.status(201).json(ResponseUtil.created(UserMessages.CREATED, user));
        } catch (error) {
            next(error);
        }
    };

    getUserById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.getUserById(RequestUtil.getParam(req.params.id));

            return res.status(200).json(ResponseUtil.success(UserMessages.FETCHED, user));
        } catch (error) {
            next(error);
        }
    };

    getUserByEmail = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.getUserByEmail(RequestUtil.getParam(req.params.email));

            return res.status(200).json(ResponseUtil.success(UserMessages.FETCHED, user));
        } catch (error) {
            next(error);
        }
    };

    getUsers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const users = await this.userService.getUsers({
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                email: req.query.email as string,
                globalRoleId: req.query.globalRoleId as string,
                status: req.query.status as any,
                authProvider: req.query.authProvider as any,
                isEmailVerified:
                    req.query.isEmailVerified !== undefined
                        ? req.query.isEmailVerified === "true"
                        : undefined,
                isPhoneVerified:
                    req.query.isPhoneVerified !== undefined
                        ? req.query.isPhoneVerified === "true"
                        : undefined,
                isMfaEnabled:
                    req.query.isMfaEnabled !== undefined ? req.query.isMfaEnabled === "true" : undefined,
                isDeleted: req.query.isDeleted !== undefined ? req.query.isDeleted === "true" : false,
                sortBy: req.query.sortBy as string,
                sortOrder: req.query.sortOrder as "asc" | "desc",
            });

            return res
                .status(200)
                .json(
                    ResponseUtil.paginated(
                        UserMessages.FETCHED_ALL,
                        users.data,
                        users.pagination.page,
                        users.pagination.limit,
                        users.pagination.total,
                    ),
                );
        } catch (error) {
            next(error);
        }
    };

    updateUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.updateUser(
                RequestUtil.getParam(req.params.id),
                req.body,
                req.user?.id as any,
            );

            return res.status(200).json(ResponseUtil.success(UserMessages.UPDATED, user));
        } catch (error) {
            next(error);
        }
    };

    updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.updateUserStatus(
                RequestUtil.getParam(req.params.id),
                req.body.status,
                req.user?.id as any,
            );

            return res.status(200).json(ResponseUtil.success(UserMessages.STATUS_UPDATED, user));
        } catch (error) {
            next(error);
        }
    };

    deleteUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            await this.userService.deleteUser(RequestUtil.getParam(req.params.id), req.user?.id as any);

            return res.status(200).json(ResponseUtil.success(UserMessages.DELETED));
        } catch (error) {
            next(error);
        }
    };

    restoreUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await this.userService.restoreUser(
                RequestUtil.getParam(req.params.id),
                req.user?.id as any,
            );

            return res.status(200).json(ResponseUtil.success(UserMessages.RESTORED, user));
        } catch (error) {
            next(error);
        }
    };
}
