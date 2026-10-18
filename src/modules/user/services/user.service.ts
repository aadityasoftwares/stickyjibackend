import { Types } from "mongoose";

import type {
    IUser,
    IUserDocument,
    IUserFilter,
} from "../interfaces/user.interface.js";

import { UserRepository } from "../repositories/user.repository.js";

import { UserMessages } from "../constants/user.messages.js";

import {
    UserAuthProvider,
    UserStatus,
} from "../constants/user.enums.js";

import {
    AuditLogAction,
} from "../../auditlog/constants/auditLog.enums.js";

import {
    AuditLogService,
} from "../../auditlog/services/auditLog.service.js";

import type {
    IAuditLogContext,
} from "../../auditlog/interfaces/auditLog.interface.js";

import {
    AppModule,
} from "../../../utils/enums/appModule.enums.js";

import {
    AppError,
} from "../../../utils/errors/app.error.js";

import {
    StringHelper,
} from "../../../utils/helpers/string.helper.js";

import {
    welcomeEmailTemplate,
} from "../../../emails/templates/welcome.template.js";

import {
    sendEmail,
} from "../../../emails/services/emailService.js";

import {
    RoleScope,
} from "../../roles/constants/role.enums.js";

import {
    RoleModel,
} from "../../roles/models/role.model.js";
import { UserWorkspaceProvisioningService } from "../../workspace/services/userWorkspaceProvisioning.service.js";
import bcrypt from "bcryptjs";
import { AUTH_CONSTANTS } from "../../auth/constants/auth.constants.js";
import { UserPreferenceProvisioningService } from "../../userpreference/seeders/userPreferenceProvisioning.service.js";
import { UserSubscriptionService } from "../../usersubscription/services/usersubscription.service.js";



type CreateUserInput =
    Partial<IUser> &
    Pick<IUser, "email" | "authProvider">;


type ResolvedGlobalRole = {
    id: Types.ObjectId;
    code: string;
};


export interface CreateUserOptions {
    provisionDefaults?: boolean;
    sendWelcomeEmail?: boolean;
    writeAuditLog?: boolean;
}


const DEFAULT_GLOBAL_ROLE_CODE = "USER";


export class UserService {
    private userRepository: UserRepository;

    private auditLogService: AuditLogService;

    private userWorkspaceProvisioningService:
        UserWorkspaceProvisioningService;

    private userPreferenceProvisioningService:
        UserPreferenceProvisioningService;

    private userSubscriptionService: UserSubscriptionService;

    constructor() {
        this.userRepository =
            new UserRepository();

        this.auditLogService =
            new AuditLogService();

        this.userWorkspaceProvisioningService =
            new UserWorkspaceProvisioningService();

        this.userPreferenceProvisioningService =
            new UserPreferenceProvisioningService();

        this.userSubscriptionService =
            new UserSubscriptionService();

    }


    async createUser(
        data: CreateUserInput,
        context?: IAuditLogContext,
        options:
            CreateUserOptions = {},
    ) {
        const {
            provisionDefaults = true,
            sendWelcomeEmail = true,
            writeAuditLog = true,
        } = options;

        const email =
            StringHelper.normalizeEmail(
                data.email,
            );

        const emailExists =
            await this.userRepository
                .existsByEmail(
                    email,
                );

        if (emailExists) {
            throw new AppError(
                UserMessages.EMAIL_ALREADY_EXISTS,
                409,
            );
        }

        const phone =
            data.phone
                ? StringHelper.normalize(
                    data.phone,
                )
                : null;

        if (phone) {
            const phoneExists =
                await this.userRepository
                    .existsByPhone(
                        phone,
                    );

            if (phoneExists) {
                throw new AppError(
                    UserMessages.PHONE_ALREADY_EXISTS,
                    409,
                );
            }
        }

        /*
         * Resolve all prerequisites BEFORE writing
         * the user record.
         */
        const globalRole =
            await this.resolveGlobalRole(
                data.globalRoleId,
            );

        const userData:
            Partial<IUser> = {
            ...data,

            email,

            phone,

            globalRoleId:
                globalRole.id,
        };

        if (
            data.authProvider ===
            UserAuthProvider.LOCAL
        ) {
            if (!data.password) {
                throw new AppError(
                    "Password is required for local authentication.",
                    400,
                );
            }

            userData.password =
                await bcrypt.hash(
                    data.password,
                    AUTH_CONSTANTS
                        .PASSWORD
                        .SALT_ROUNDS,
                );
        } else {
            userData.password =
                undefined;
        }

        let user:
            IUserDocument;

        try {
            user =
                await this.userRepository
                    .create(
                        userData,
                    );
        } catch (error) {
            throw this
                .mapCreateUserPersistenceError(
                    error,
                );
        }

        /*
         * IMPORTANT
         *
         * Once MongoDB has persisted the user, optional
         * integrations must not make the caller think that
         * the user was not created.
         */
        if (writeAuditLog) {
            await this
                .safeLogUserCreated(
                    user,
                    context,
                );
        }

        if (
            provisionDefaults &&
            globalRole.code ===
            DEFAULT_GLOBAL_ROLE_CODE
        ) {
            await this
                .safeProvisionUserDefaults(
                    user,
                    context,
                );
        }

        if (sendWelcomeEmail) {
            void this
                .sendWelcomeEmail(
                    user,
                );
        }

        return user;
    }


    /**
     * Complete self-registration only after the critical
     * registration phase has succeeded.
     *
     * This method intentionally never throws.
     *
     * The account already exists at this stage, therefore
     * welcome email / audit / starter-data problems must
     * not make the frontend display "registration failed".
     */
    async completeRegistration(
        user: IUserDocument,
        context?: IAuditLogContext,
    ): Promise<void> {
        try {
            await this.userSubscriptionService.ensureFreeSubscription(user._id.toString(), context);
        } catch (error) {
            console.error("Registration succeeded, but Free subscription provisioning failed.", {
                userId: user._id.toString(),
                error,
            });
        }

        await this
            .safeLogUserCreated(
                user,
                context,
            );
        await this.safeProvisionUserPreferences(
            user,
        );

        try {
            const role =
                await RoleModel
                    .findById(
                        user.globalRoleId,
                    )
                    .select(
                        "_id code",
                    )
                    .lean();

            if (
                role?.code ===
                DEFAULT_GLOBAL_ROLE_CODE
            ) {
                await this
                    .safeProvisionUserDefaults(
                        user,
                        context,
                    );
            }
        } catch (error) {
            console.error(
                "Registration succeeded, but the user role could not be resolved for default provisioning.",
                {
                    userId:
                        user._id.toString(),

                    error,
                },
            );
        }

        /*
         * Email is deliberately started only after
         * user + profile + session have succeeded.
         */
        void this
            .sendWelcomeEmail(
                user,
            );
    }


    /**
     * Resolve the selected global role.
     *
     * Returns the role ID for persistence and
     * role code for deciding whether default
     * workspace provisioning is required.
     */
    private async resolveGlobalRole(
        requestedRoleId?:
            IUser["globalRoleId"],
    ): Promise<ResolvedGlobalRole> {
        /*
         * Explicit role supplied.
         */
        if (requestedRoleId) {
            if (
                !Types.ObjectId.isValid(
                    requestedRoleId.toString(),
                )
            ) {
                throw new AppError(
                    "Invalid global role ID.",
                    400,
                );
            }


            const requestedRole =
                await RoleModel.findOne({
                    _id:
                        requestedRoleId,

                    scope:
                        RoleScope.GLOBAL,

                    isActive:
                        true,
                })
                    .select(
                        "_id code",
                    )
                    .lean();


            if (!requestedRole) {
                throw new AppError(
                    "The selected global role does not exist or is inactive.",
                    400,
                );
            }


            return {
                id:
                    requestedRole._id,

                code:
                    requestedRole.code,
            };
        }


        /*
         * No role supplied.
         *
         * Self-registration / standard user
         * receives the seeded USER global role.
         */
        const defaultRole =
            await RoleModel.findOne({
                code:
                    DEFAULT_GLOBAL_ROLE_CODE,

                scope:
                    RoleScope.GLOBAL,

                isSystem:
                    true,

                isActive:
                    true,
            })
                .select(
                    "_id code",
                )
                .lean();


        if (!defaultRole) {
            throw new AppError(
                "User creation is temporarily unavailable because the default USER role is not configured.",
                503,
            );
        }


        return {
            id:
                defaultRole._id,

            code:
                defaultRole.code,
        };
    }


    private async safeLogUserCreated(
        user: IUserDocument,
        context?: IAuditLogContext,
    ): Promise<void> {
        try {
            await this.auditLogService
                .logCreate(
                    context ?? {},
                    {
                        module:
                            AppModule.USER,

                        resourceId:
                            user._id
                                .toString(),

                        resourceName:
                            user.email,
                    },
                    `User ${user.email} was created successfully.`,
                );
        } catch (error) {
            console.error(
                "User was created, but the user-created audit log could not be written.",
                {
                    userId:
                        user._id.toString(),

                    error,
                },
            );
        }
    }


    private async safeProvisionUserDefaults(
        user: IUserDocument,
        context?: IAuditLogContext,
    ): Promise<void> {
        try {
            await this
                .userWorkspaceProvisioningService
                .provisionUserDefaults(
                    user,
                    context,
                );
        } catch (error) {
            /*
             * provisionUserDefaults() currently catches its
             * own errors, but this outer guard keeps signup
             * safe even if that implementation changes later.
             */
            console.error(
                "User registration succeeded, but starter workspace provisioning failed.",
                {
                    userId:
                        user._id.toString(),

                    error,
                },
            );
        }
    }

    private async safeProvisionUserPreferences(
        user: IUserDocument,
    ): Promise<void> {
        try {
            await this
                .userPreferenceProvisioningService
                .provisionMissingPreferences(
                    user._id.toString(),
                );
        } catch (error) {
            console.error(
                "User registration succeeded, but default user preferences could not be provisioned.",
                {
                    userId: user._id.toString(),
                    error,
                },
            );
        }
    }


    private mapCreateUserPersistenceError(
        error: unknown,
    ): unknown {
        if (
            !error ||
            typeof error !==
            "object"
        ) {
            return error;
        }

        const mongoError =
            error as {
                code?: number;
                keyPattern?: Record<
                    string,
                    unknown
                >;
            };

        if (
            mongoError.code !==
            11000
        ) {
            return error;
        }

        if (
            mongoError.keyPattern
                ?.email
        ) {
            return new AppError(
                UserMessages
                    .EMAIL_ALREADY_EXISTS,
                409,
            );
        }

        if (
            mongoError.keyPattern
                ?.phone
        ) {
            return new AppError(
                UserMessages
                    .PHONE_ALREADY_EXISTS,
                409,
            );
        }

        return new AppError(
            "A user with the same unique account information already exists.",
            409,
        );
    }


    private async sendWelcomeEmail(
        user: IUserDocument,
    ): Promise<void> {
        try {
            const html =
                welcomeEmailTemplate({
                    userName:
                        user.email ||
                        "there",
                });


            await sendEmail({
                to:
                    user.email,

                subject:
                    "Welcome to Sticky Ji 👋",

                html,
            });
        } catch (error) {
            console.error(
                `Failed to send welcome email to ${user.email}:`,
                error,
            );
        }
    }


    async getUserById(
        id: string,
    ) {
        const user =
            await this.userRepository.findById(
                id,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        return user;
    }


    async getUserByEmail(
        email: string,
    ) {
        const normalizedEmail =
            StringHelper.normalizeEmail(
                email,
            );


        const user =
            await this.userRepository.findByEmail(
                normalizedEmail,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        return user;
    }


    async getUserByProvider(
        authProvider:
            UserAuthProvider,

        providerId:
            string,
    ) {
        const normalizedProviderId =
            StringHelper.normalize(
                providerId,
            );


        const user =
            await this.userRepository.findByProvider(
                authProvider,
                normalizedProviderId,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        return user;
    }


    async getUsers(
        filters: IUserFilter = {},
    ) {
        if (filters.search) {
            filters.search =
                StringHelper.normalizeWhitespace(
                    filters.search,
                );
        }


        if (filters.email) {
            filters.email =
                StringHelper.normalizeEmail(
                    filters.email,
                );
        }


        return this.userRepository.findAll(
            filters,
        );
    }


    async updateUser(
        id: string,
        data: Partial<IUser>,
        updatedBy?: IUser["updatedBy"],
        context?: IAuditLogContext,
    ) {
        const user =
            await this.userRepository.findById(
                id,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        if (
            Object.keys(data).length ===
            0
        ) {
            throw new AppError(
                UserMessages.UPDATE_REQUIRED,
                400,
            );
        }


        if (
            data.email !==
            undefined
        ) {
            throw new AppError(
                UserMessages.EMAIL_CANNOT_BE_UPDATED,
                400,
            );
        }


        if (
            data.password !==
            undefined
        ) {
            throw new AppError(
                UserMessages.PASSWORD_CANNOT_BE_UPDATED,
                400,
            );
        }


        if (
            data.globalRoleId !==
            undefined
        ) {
            throw new AppError(
                UserMessages.ROLE_CANNOT_BE_UPDATED,
                400,
            );
        }


        if (
            data.phone !==
            undefined
        ) {
            data.phone =
                StringHelper.emptyToNull(
                    data.phone,
                );


            if (
                data.phone &&
                data.phone !==
                user.phone
            ) {
                const phoneExists =
                    await this.userRepository.existsByPhone(
                        data.phone,
                    );


                if (phoneExists) {
                    throw new AppError(
                        UserMessages.PHONE_ALREADY_EXISTS,
                        409,
                    );
                }
            }
        }


        const changes =
            Object.keys(data)
                .filter(
                    (field) =>
                        field !==
                        "password" &&
                        field !==
                        "email" &&
                        field !==
                        "globalRoleId",
                )
                .map(
                    (field) => ({
                        field,

                        oldValue:
                            this.sanitizeAuditValue(
                                field,
                                (user as any)[
                                field
                                ],
                            ),

                        newValue:
                            this.sanitizeAuditValue(
                                field,
                                (
                                    data as Record<
                                        string,
                                        unknown
                                    >
                                )[field],
                            ),
                    }),
                );


        const updateData:
            Partial<IUser> = {
            ...data,

            ...(updatedBy !==
                undefined
                ? {
                    updatedBy,
                }
                : {}),
        };


        const updatedUser =
            await this.userRepository.updateById(
                id,
                updateData,
            );


        if (!updatedUser) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        if (
            changes.length >
            0
        ) {
            await this.auditLogService.logUpdate(
                context ?? {},
                {
                    module:
                        AppModule.USER,

                    resourceId:
                        user._id.toString(),

                    resourceName:
                        user.email,
                },
                `User ${user.email} was updated successfully.`,
                changes,
            );
        }


        return updatedUser;
    }


    async updateUserStatus(
        id: string,
        status: UserStatus,
        updatedBy?: IUser["updatedBy"],
        context?: IAuditLogContext,
    ) {
        const user =
            await this.userRepository.findById(
                id,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        if (
            user.status ===
            status
        ) {
            return user;
        }


        const oldStatus =
            user.status;


        const updatedUser =
            await this.userRepository.updateStatus(
                id,
                status,
                updatedBy,
            );


        if (!updatedUser) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        await this.auditLogService.logStatusChange(
            context ?? {},
            {
                module:
                    AppModule.USER,

                resourceId:
                    user._id.toString(),

                resourceName:
                    user.email,
            },
            "status",
            oldStatus,
            status,
            `User ${user.email} status changed from ${oldStatus} to ${status}.`,
        );


        return updatedUser;
    }


    async deleteUser(
        id: string,
        updatedBy?: IUser["updatedBy"],
        context?: IAuditLogContext,
    ) {
        const user =
            await this.userRepository.findById(
                id,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        const deletedUser =
            await this.userRepository.softDelete(
                id,
                updatedBy,
            );


        if (!deletedUser) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        await this.auditLogService.logDelete(
            context ?? {},
            {
                module:
                    AppModule.USER,

                resourceId:
                    user._id.toString(),

                resourceName:
                    user.email,
            },
            `User ${user.email} was deleted successfully.`,
        );


        return deletedUser;
    }


    async restoreUser(
        id: string,
        updatedBy?: IUser["updatedBy"],
        context?: IAuditLogContext,
    ) {
        const user =
            await this.userRepository.findByIdIncludingDeleted(
                id,
            );


        if (!user) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        if (!user.isDeleted) {
            return user;
        }


        const restoredUser =
            await this.userRepository.restore(
                id,
                updatedBy,
            );


        if (!restoredUser) {
            throw new AppError(
                UserMessages.NOT_FOUND,
                404,
            );
        }


        await this.auditLogService.log({
            ...context,

            action:
                AuditLogAction.RESTORE,

            module:
                AppModule.USER,

            resourceId:
                new Types.ObjectId(
                    id,
                ),

            resourceName:
                user.email,

            description:
                `User ${user.email} was restored successfully.`,
        });


        return restoredUser;
    }


    private sanitizeAuditValue(
        field: string,
        value: unknown,
    ): unknown {
        const sensitiveFields = [
            "password",
            "currentPassword",
            "newPassword",
            "confirmPassword",
            "token",
            "accessToken",
            "refreshToken",
            "apiKey",
            "secret",
            "secretKey",
            "otp",
            "authorization",
            "mfaSecret",
            "passwordResetTokenHash",
            "emailVerificationTokenHash",
        ];


        if (
            sensitiveFields.includes(
                field,
            )
        ) {
            return "[REDACTED]";
        }


        if (
            value instanceof
            Types.ObjectId
        ) {
            return value.toString();
        }


        return value;
    }

    async provisionMissingUserPreferences(userId: string): Promise<void> {
        try {
            await this.userPreferenceProvisioningService.provisionMissingPreferences(userId);
        } catch (error) {
            console.error("Missing user preferences could not be provisioned.", {
                userId,
                error,
            });
        }
    }
}
